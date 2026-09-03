import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { extractSubjectPalette, remapFramesToPalette } from "./palette-lock.js";

function rawToPng(width: number, height: number, rgba: number[]): Promise<Buffer> {
  return sharp(Buffer.from(rgba), { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

test("extracts only opaque, non-background subject colors", async () => {
  const sprite = await rawToPng(6, 1, [
    // red subject
    255, 0, 0, 255,
    // exact chroma green
    0x00, 0xb1, 0x40, 255,
    // green within the chroma tolerance band
    20, 0xb1, 64, 255,
    // legitimate darker subject green (outside the band)
    0, 150, 30, 255,
    // semi-transparent fringe
    10, 0xb1, 50, 120,
    // fully transparent pixel
    0x00, 0xb1, 0x40, 0,
  ]);

  const palette = await extractSubjectPalette(sprite);
  const packed = new Set(palette.map(([r, g, b]) => (r << 16) | (g << 8) | b));
  assert.equal(palette.length, 2);
  assert.ok(packed.has((255 << 16) | 0));
  assert.ok(packed.has((0 << 16) | (150 << 8) | 30));
});

test("rejects a sprite with no subject colors", async () => {
  const sprite = await rawToPng(1, 1, [0x00, 0xb1, 0x40, 255]);
  await assert.rejects(extractSubjectPalette(sprite), /no usable subject colors/);
});

test("remaps off-palette pixels to the nearest palette color and preserves alpha", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "palette-lock-"));
  const frame = await rawToPng(3, 1, [
    // off-palette orange → maps to red
    250, 128, 0, 255,
    // off-palette at partial alpha → RGB remapped, alpha untouched
    250, 128, 0, 200,
    // fully transparent → untouched
    0x00, 0xb1, 0x40, 0,
  ]);
  await writeFile(path.join(dir, "frame-00001.png"), frame);

  await remapFramesToPalette(dir, [[255, 0, 0], [0, 0, 255]]);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".png"));
  assert.deepEqual(files, ["frame-00001.png"]);
  const { data } = await sharp(await readFile(path.join(dir, files[0])))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.slice(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...data.slice(4, 8)], [255, 0, 0, 200]);
  assert.deepEqual([...data.slice(8, 12)], [0x00, 0xb1, 0x40, 0]);
});
