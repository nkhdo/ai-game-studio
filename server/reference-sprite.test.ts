import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { assessBackground, normalizeReferenceImage } from "./reference-sprite.js";

test("recognizes a uniform chroma-green border as suitable", async () => {
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 177, b: 64 } },
  })
    .png()
    .toBuffer();

  assert.equal(await assessBackground(image), "suitable");
});

test("warns when the border is not chroma green", async () => {
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 30, g: 40, b: 80 } },
  })
    .png()
    .toBuffer();

  assert.equal(await assessBackground(image), "warning");
});

test("normalizes WebP transparency onto chroma green as an opaque PNG", async () => {
  const source = await sharp({
    create: { width: 48, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .webp()
    .toBuffer();

  const normalized = await normalizeReferenceImage(source);
  const metadata = await sharp(normalized.buffer).metadata();
  const corner = await sharp(normalized.buffer).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();

  assert.equal(metadata.format, "png");
  assert.equal(metadata.hasAlpha, false);
  assert.deepEqual(normalized.dimensions, { w: 48, h: 32 });
  assert.deepEqual([...corner], [0, 177, 64]);
  assert.equal(normalized.backgroundSuitability, "suitable");
});

test("rejects decoded images beyond the dimension limit", async () => {
  const source = await sharp({
    create: { width: 4097, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();

  await assert.rejects(
    normalizeReferenceImage(source),
    /maximum 4096 px per side and 16 megapixels/,
  );
});
