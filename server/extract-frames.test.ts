import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { ROOT_DIR } from "./files.js";
import { resizeExtractedFrames } from "./extract-frames.js";

test("frame extraction keeps native dimensions until post-processing", async () => {
  const script = await readFile(path.join(ROOT_DIR, "scripts", "extract-frames.sh"), "utf8");
  assert.doesNotMatch(script, /scale=/);
  assert.doesNotMatch(script, /pad=/);
});

test("post-processing resize contain-fits and transparently pads with nearest neighbor", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "resize-frames-"));
  const input = await sharp({
    create: { width: 4, height: 2, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer();
  await writeFile(path.join(dir, "frame-00001.png"), input);
  await resizeExtractedFrames(dir, ["frame-00001.png"], 8);
  const { data, info } = await sharp(path.join(dir, "frame-00001.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual({ width: info.width, height: info.height }, { width: 8, height: 8 });
  assert.equal(data[3], 0);
  assert.deepEqual([...data.slice(2 * 8 * 4, 2 * 8 * 4 + 4)], [255, 0, 0, 255]);
});
