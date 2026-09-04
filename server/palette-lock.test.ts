import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  conformToReferencePalette,
  extractSubjectPalette,
  processMovementFrame,
  remapFramesToPalette,
} from "./palette-lock.js";

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

test("conservatively remaps supported colors and resolves uncertain colors locally", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "palette-lock-"));
  const frame = await rawToPng(4, 1, [
    // Three supported near-red pixels map to red.
    255, 0, 0, 255,
    230, 10, 10, 255,
    255, 0, 0, 255,
    // A distant color inherits the nearby red palette region.
    180, 30, 30, 255,
  ]);
  await writeFile(path.join(dir, "frame-00001.png"), frame);

  const stats = await remapFramesToPalette(dir, [[255, 0, 0], [0, 0, 255]]);

  assert.equal(stats.preservedOffPalettePixels, 0);
  const { data } = await sharp(await readFile(path.join(dir, "frame-00001.png")))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.slice(0, 12)], [
    255, 0, 0, 255,
    255, 0, 0, 255,
    255, 0, 0, 255,
  ]);
  assert.deepEqual([...data.slice(12, 16)], [255, 0, 0, 255]);
});

test("uses actual pixel distance and rejects an isolated mid-distance candidate", async () => {
  const frame = await rawToPng(3, 1, [
    12, 12, 12, 255,
    13, 13, 13, 255,
    0x00, 0xb1, 0x40, 0,
  ]);
  const result = await processMovementFrame(frame, [[0, 0, 0]]);
  const { data } = await sharp(result.image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.slice(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...data.slice(4, 8)], [0, 0, 0, 255]);
  assert.deepEqual([...data.slice(8, 12)], [0x00, 0xb1, 0x40, 0]);
  assert.equal(result.stats.preservedOffPalettePixels, 0);
});

test("hard alpha removes fringes before palette matching and makes subject opaque", async () => {
  const frame = await rawToPng(3, 1, [
    250, 0, 0, 127,
    250, 0, 0, 128,
    0, 0, 0, 0,
  ]);
  const result = await processMovementFrame(frame, [[255, 0, 0]], {
    hardAlphaEdges: true,
  });
  const { data } = await sharp(result.image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.slice(0, 4)], [0, 0, 0, 0]);
  assert.deepEqual([...data.slice(4, 8)], [255, 0, 0, 255]);
  assert.deepEqual([...data.slice(8, 12)], [0, 0, 0, 0]);
  assert.equal(result.stats.removedLowAlphaPixels, 1);
});

test("hard alpha removes semi-transparent chroma fringe beside transparent background", async () => {
  const frame = await rawToPng(4, 1, [
    0, 0, 0, 0,
    12, 170, 70, 180,
    20, 165, 75, 190,
    230, 10, 10, 180,
  ]);
  const result = await processMovementFrame(frame, [[255, 0, 0]], {
    hardAlphaEdges: true,
  });
  const data = await sharp(result.image).ensureAlpha().raw().toBuffer();
  assert.deepEqual([...data.slice(4, 8)], [0, 0, 0, 0]);
  assert.deepEqual([...data.slice(8, 12)], [0, 0, 0, 0]);
  assert.deepEqual([...data.slice(12, 16)], [255, 0, 0, 255]);
  assert.equal(result.stats.removedChromaFringePixels, 2);
});

test("transparent neighbors do not count as confident local palette evidence", async () => {
  const frame = await rawToPng(3, 1, [
    230, 10, 10, 0,
    230, 10, 10, 255,
    230, 10, 10, 0,
  ]);
  const result = await processMovementFrame(frame, [[255, 0, 0]]);
  const data = await sharp(result.image).ensureAlpha().raw().toBuffer();
  assert.deepEqual([...data.slice(4, 8)], [255, 0, 0, 255]);
  assert.equal(result.stats.preservedOffPalettePixels, 0);
});

test("neighbor decisions use the immutable input instead of remapped output", async () => {
  const frame = await rawToPng(3, 1, [
    230, 10, 10, 255,
    230, 10, 10, 255,
    255, 0, 0, 255,
  ]);
  const result = await processMovementFrame(frame, [[255, 0, 0]]);
  const data = await sharp(result.image).ensureAlpha().raw().toBuffer();
  assert.deepEqual([...data.slice(0, 12)], [
    255, 0, 0, 255,
    255, 0, 0, 255,
    255, 0, 0, 255,
  ]);
});

test("uncertain pixels inherit the dominant local palette color", async () => {
  const frame = await rawToPng(3, 3, [
    156, 190, 170, 255, 156, 190, 170, 255, 156, 190, 170, 255,
    156, 190, 170, 255, 130, 135, 133, 255, 156, 190, 170, 255,
    156, 190, 170, 255, 156, 190, 170, 255, 72, 88, 132, 255,
  ]);
  const result = await processMovementFrame(frame, [[156, 190, 170], [72, 88, 132]]);
  const data = await sharp(result.image).ensureAlpha().raw().toBuffer();
  assert.deepEqual([...data.slice(16, 20)], [156, 190, 170, 255]);
  assert.equal(result.stats.preservedOffPalettePixels, 0);
});

test("conforms a generated sprite to the union palette of reference images, preserving chroma", async () => {
  // Generated sprite: chroma background + off-palette orange subject
  const generated = await rawToPng(2, 1, [
    0x00, 0xb1, 0x40, 255,
    250, 128, 0, 255,
  ]);
  // Two references: red in the first, blue in the second
  const ref1 = await rawToPng(1, 1, [255, 0, 0, 255]);
  const ref2 = await rawToPng(1, 1, [0, 0, 255, 255]);

  const conformed = await conformToReferencePalette(generated, [ref1, ref2]);
  const { data } = await sharp(conformed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // chroma background untouched
  assert.deepEqual([...data.slice(0, 4)], [0x00, 0xb1, 0x40, 255]);
  // orange → nearest of {red, blue} = red
  assert.deepEqual([...data.slice(4, 8)], [255, 0, 0, 255]);
});

test("returns the image unchanged when no references participate", async () => {
  const image = await rawToPng(1, 1, [250, 128, 0, 255]);
  const conformed = await conformToReferencePalette(image, []);
  assert.deepEqual([...(await sharp(conformed).raw().toBuffer())], [250, 128, 0, 255]);
});
