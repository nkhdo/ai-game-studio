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
export async function remapFramesToPalette(framesDir: string, palette: number[][]): Promise<void> {
  const entries = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
  for (const entry of entries) {
    const file = path.join(framesDir, entry);
    await writeFile(file, await remapToPalette(await readFile(file), palette));
  }
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
