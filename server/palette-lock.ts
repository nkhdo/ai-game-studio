// Palette Lock: constrain extracted Movement Frames to the Reference Sprite's
// Subject Palette. Palette extraction excludes the chroma-green background;
// the remap touches RGB only and never modifies the alpha channel.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Keep in sync with chromakey=0x00b140 in scripts/extract-frames.sh.
const CHROMA_GREEN = { r: 0x00, g: 0xb1, b: 0x40 };
// Per-channel distance around #00b140 treated as background, not subject color.
const CHROMA_TOLERANCE = 24;

// Nearest-color lookup is quantized to 4 bits per channel (4096 buckets): the
// nearest palette entry is computed once per bucket instead of per pixel.
// Compressed video frames contain far too many distinct colors for exact
// per-pixel scans, and the quantization error is imperceptible next to
// video-compression noise.
const LUT_BITS = 4;
const LUT_SIZE = 1 << (LUT_BITS * 3);

/** Extract the Subject Palette: distinct colors of opaque, non-background sprite pixels. */
export async function extractSubjectPalette(sprite: Buffer): Promise<number[][]> {
  const { data } = await sharp(sprite).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const palette = new Set<number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (
      Math.abs(r - CHROMA_GREEN.r) <= CHROMA_TOLERANCE &&
      Math.abs(g - CHROMA_GREEN.g) <= CHROMA_TOLERANCE &&
      Math.abs(b - CHROMA_GREEN.b) <= CHROMA_TOLERANCE
    ) {
      continue;
    }
    palette.add((r << 16) | (g << 8) | b);
  }
  if (palette.size === 0) {
    throw new Error("Reference Sprite has no usable subject colors for Palette Lock");
  }
  return [...palette].map((packed) => [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff]);
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

/** Remap every frame in `framesDir` in place to the nearest Subject Palette color. */
export async function remapFramesToPalette(framesDir: string, palette: number[][]): Promise<void> {
  const lut = buildPaletteLut(palette);
  const entries = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
  for (const entry of entries) {
    const file = path.join(framesDir, entry);
    const input = await readFile(file);
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // fully transparent: RGB is invisible
      const key =
        ((data[i] >> LUT_BITS) << 8) | ((data[i + 1] >> LUT_BITS) << 4) | (data[i + 2] >> LUT_BITS);
      const packed = lut[key];
      data[i] = (packed >> 16) & 0xff;
      data[i + 1] = (packed >> 8) & 0xff;
      data[i + 2] = packed & 0xff;
    }
    await writeFile(
      file,
      await sharp(data, {
        raw: { width: info.width, height: info.height, channels: info.channels },
      })
        .png()
        .toBuffer(),
    );
  }
}
