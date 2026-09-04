// Palette Lock + Palette Conformance: constrain image colors to a palette.
// - Palette Lock: Movement Frames remapped to the Reference Sprite's Subject
//   Palette (chroma green excluded from the palette).
// - Palette Conformance: a generated Reference Sprite remapped to the union
//   palette of the reference images used by its acquisition; the sprite's own
//   chroma background is left untouched so keying survives.
// The remap touches RGB only and never modifies the alpha channel.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Keep in sync with chromakey=0x00b140 in scripts/extract-frames.sh.
const CHROMA_GREEN = { r: 0x00, g: 0xb1, b: 0x40 };
// Per-channel distance around #00b140 treated as background, not subject color.
const CHROMA_TOLERANCE = 24;

function isChroma(r: number, g: number, b: number): boolean {
  return (
    Math.abs(r - CHROMA_GREEN.r) <= CHROMA_TOLERANCE &&
    Math.abs(g - CHROMA_GREEN.g) <= CHROMA_TOLERANCE &&
    Math.abs(b - CHROMA_GREEN.b) <= CHROMA_TOLERANCE
  );
}

// Nearest-color lookup is quantized to 4 bits per channel (4096 buckets): the
// nearest palette entry is computed once per bucket instead of per pixel.
// Compressed video frames contain far too many distinct colors for exact
// per-pixel scans, and the quantization error is imperceptible next to
// video-compression noise.
const LUT_BITS = 4;
const LUT_SIZE = 1 << (LUT_BITS * 3);

export interface ExtractPaletteOptions {
  /** Skip pixels within the chroma band of #00b140 (Subject Palette extraction). */
  excludeChroma?: boolean;
}

/** Extract the distinct colors of opaque pixels as an RGB palette. */
export async function extractPalette(
  image: Buffer,
  options: ExtractPaletteOptions = {},
): Promise<number[][]> {
  const { data } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const palette = new Set<number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (options.excludeChroma && isChroma(r, g, b)) continue;
    palette.add((r << 16) | (g << 8) | b);
  }
  if (palette.size === 0) {
    throw new Error("image has no usable colors for palette extraction");
  }
  return [...palette].map((packed) => [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff]);
}

/** Subject Palette: distinct colors of opaque, non-background Reference Sprite pixels. */
export async function extractSubjectPalette(sprite: Buffer): Promise<number[][]> {
  try {
    return await extractPalette(sprite, { excludeChroma: true });
  } catch {
    throw new Error("Reference Sprite has no usable subject colors for Palette Lock");
  }
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("malformed data URL");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

function nearestPaletteColor(palette: number[][], r: number, g: number, b: number): number {
  // Luma-weighted metric: brightness shifts stay less visible than hue shifts.
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  const [pr, pg, pb] = palette[best];
  return (pr << 16) | (pg << 8) | pb;
}

function buildPaletteLut(palette: number[][]): Uint32Array {
  const lut = new Uint32Array(LUT_SIZE);
  for (let key = 0; key < LUT_SIZE; key++) {
    const r = (((key >> 8) & 0xf) << 4) | 8;
    const g = (((key >> 4) & 0xf) << 4) | 8;
    const b = ((key & 0xf) << 4) | 8;
    lut[key] = nearestPaletteColor(palette, r, g, b);
  }
  return lut;
}

export interface RemapOptions {
  /** Leave pixels within the chroma band untouched (keeps the keyable background). */
  preserveChroma?: boolean;
}

export interface FramePaletteOptions {
  exactTolerance?: number;
  maxDistance?: number;
  minMatchingNeighbors?: number;
  hardAlphaEdges?: boolean;
}

export interface FrameProcessingStats {
  preservedOffPalettePixels: number;
  removedLowAlphaPixels: number;
}

const DEFAULT_FRAME_OPTIONS = {
  exactTolerance: 12,
  maxDistance: 32,
  minMatchingNeighbors: 2,
} as const;

function nearestPaletteMatch(
  palette: number[][],
  r: number,
  g: number,
  b: number,
): { index: number; packed: number; distance: number } {
  let index = 0;
  let bestSquaredDistance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const squaredDistance = (2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9;
    if (squaredDistance < bestSquaredDistance) {
      bestSquaredDistance = squaredDistance;
      index = i;
    }
  }
  const [pr, pg, pb] = palette[index];
  return {
    index,
    packed: (pr << 16) | (pg << 8) | pb,
    distance: Math.sqrt(bestSquaredDistance),
  };
}

/** Process one movement frame without changing the reference-sprite conformance behavior. */
export async function processMovementFrame(
  image: Buffer,
  palette: number[][] | null,
  options: FramePaletteOptions = {},
): Promise<{ image: Buffer; stats: FrameProcessingStats }> {
  const exactTolerance = options.exactTolerance ?? DEFAULT_FRAME_OPTIONS.exactTolerance;
  const maxDistance = options.maxDistance ?? DEFAULT_FRAME_OPTIONS.maxDistance;
  const minMatchingNeighbors =
    options.minMatchingNeighbors ?? DEFAULT_FRAME_OPTIONS.minMatchingNeighbors;
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stats: FrameProcessingStats = {
    preservedOffPalettePixels: 0,
    removedLowAlphaPixels: 0,
  };

  if (options.hardAlphaEdges) {
    for (let offset = 0; offset < data.length; offset += 4) {
      const alpha = data[offset + 3];
      if (alpha < 128) {
        if (alpha > 0) stats.removedLowAlphaPixels++;
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
      } else {
        data[offset + 3] = 255;
      }
    }
  }

  if (palette) {
    const pixelCount = info.width * info.height;
    const indices = new Int32Array(pixelCount).fill(-1);
    const distances = new Float32Array(pixelCount);
    const packedColors = new Uint32Array(pixelCount);

    for (let pixel = 0; pixel < pixelCount; pixel++) {
      const offset = pixel * 4;
      if (data[offset + 3] < 128) continue;
      const match = nearestPaletteMatch(
        palette,
        data[offset],
        data[offset + 1],
        data[offset + 2],
      );
      indices[pixel] = match.index;
      distances[pixel] = match.distance;
      packedColors[pixel] = match.packed;
    }

    for (let pixel = 0; pixel < pixelCount; pixel++) {
      if (indices[pixel] < 0) continue;
      const distance = distances[pixel];
      let accepted = distance <= exactTolerance;
      if (!accepted && distance <= maxDistance) {
        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);
        let matches = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height) continue;
            const neighbor = ny * info.width + nx;
            if (indices[neighbor] === indices[pixel] && distances[neighbor] <= maxDistance) {
              matches++;
            }
          }
        }
        accepted = matches >= minMatchingNeighbors;
      }

      if (accepted) {
        const packed = packedColors[pixel];
        const offset = pixel * 4;
        data[offset] = (packed >> 16) & 0xff;
        data[offset + 1] = (packed >> 8) & 0xff;
        data[offset + 2] = packed & 0xff;
      } else {
        stats.preservedOffPalettePixels++;
      }
    }
  }

  const output = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
  return { image: output, stats };
}

/** Remap every pixel of `image` to the nearest palette color; returns a PNG buffer. */
export async function remapToPalette(
  image: Buffer,
  palette: number[][],
  options: RemapOptions = {},
): Promise<Buffer> {
  const lut = buildPaletteLut(palette);
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // fully transparent: RGB is invisible
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (options.preserveChroma && isChroma(r, g, b)) continue;
    const packed = lut[((r >> LUT_BITS) << 8) | ((g >> LUT_BITS) << 4) | (b >> LUT_BITS)];
    data[i] = (packed >> 16) & 0xff;
    data[i + 1] = (packed >> 8) & 0xff;
    data[i + 2] = packed & 0xff;
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

/** Remap every frame in `framesDir` in place to the nearest Subject Palette color. */
export async function remapFramesToPalette(
  framesDir: string,
  palette: number[][] | null,
  options: FramePaletteOptions = {},
): Promise<FrameProcessingStats> {
  const entries = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
  const totals: FrameProcessingStats = {
    preservedOffPalettePixels: 0,
    removedLowAlphaPixels: 0,
  };
  for (const entry of entries) {
    const file = path.join(framesDir, entry);
    const result = await processMovementFrame(await readFile(file), palette, options);
    totals.preservedOffPalettePixels += result.stats.preservedOffPalettePixels;
    totals.removedLowAlphaPixels += result.stats.removedLowAlphaPixels;
    await writeFile(file, result.image);
  }
  return totals;
}

/**
 * Palette Conformance: remap `image` to the union palette of `referenceImages`.
 * The image's own chroma background is preserved. With no reference images the
 * image is returned unchanged.
 */
export async function conformToReferencePalette(
  image: Buffer,
  referenceImages: Buffer[],
): Promise<Buffer> {
  if (referenceImages.length === 0) return image;
  const seen = new Set<number>();
  const palette: number[][] = [];
  for (const reference of referenceImages) {
    for (const [r, g, b] of await extractPalette(reference)) {
      const packed = (r << 16) | (g << 8) | b;
      if (!seen.has(packed)) {
        seen.add(packed);
        palette.push([r, g, b]);
      }
    }
  }
  if (palette.length === 0) return image;
  return remapToPalette(image, palette, { preserveChroma: true });
}
