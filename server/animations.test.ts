import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureUniqueAnimationName,
  validateAnimationInput,
} from "./animations.js";
import { emptyManifest, toView, type AnimationManifest } from "./projects.js";

const input = {
  name: "run",
  frameIndices: [2, 1, 1, 3],
  fps: 12,
  dataUrl: "data:image/png;base64,AA==",
};

test("Animation Frame Sequences preserve order and repeated frames", () => {
  assert.deepEqual(validateAnimationInput(input, 4).frameIndices, [2, 1, 1, 3]);
});

test("Animation input rejects invalid frames and playback rates", () => {
  assert.throws(() => validateAnimationInput({ ...input, frameIndices: [4] }, 4), /invalid frame/);
  assert.throws(() => validateAnimationInput({ ...input, fps: 0 }, 4), /fps/);
});

test("Animation names are unique without regard to case", () => {
  const existing = { id: "one", name: "Run" } as AnimationManifest;
  assert.throws(() => ensureUniqueAnimationName([existing], "run"), /already exists/);
  assert.doesNotThrow(() => ensureUniqueAnimationName([existing], "run", "one"));
});

test("Project views expose frozen Animation assets", () => {
  const manifest = emptyManifest();
  manifest.animations = [{
    id: "one",
    name: "attack",
    frameIndices: [3, 2],
    frames: ["animations/one/frames/frame-00001.png", "animations/one/frames/frame-00002.png"],
    fps: 8,
    spritesheet: "animations/one/spritesheet.png",
    previewGif: "animations/one/preview.gif",
    createdAt: manifest.updatedAt,
    updatedAt: manifest.updatedAt,
  }];
  const animation = toView(manifest).animations[0];
  assert.deepEqual(animation.frameIndices, [3, 2]);
  assert.match(animation.frameUrls[0], /animations\/one\/frames/);
  assert.equal(animation.fps, 8);
});
