import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureUniqueAnimationName,
  createAnimation,
  updateAnimation,
  validateAnimationInput,
} from "./animations.js";
import { projectDir, runInProject } from "./files.js";
import { emptyManifest, toView, writeManifest, type AnimationManifest } from "./projects.js";

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

test("updating an Animation replaces its frozen Frame Sequence", async () => {
  const projectId = "00000000-0000-4000-8000-000000000091";
  const dir = projectDir(projectId);
  try {
    await mkdir(path.join(dir, "frames"), { recursive: true });
    await mkdir(path.join(dir, "animations/run/frames"), { recursive: true });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    for (const file of [
      "frames/frame-1.png", "frames/frame-2.png",
      "animations/run/frames/frame-00001.png",
    ]) {
      await writeFile(path.join(dir, file), png);
    }
    const manifest = emptyManifest(projectId);
    manifest.frames = ["frames/frame-1.png", "frames/frame-2.png"];
    manifest.targetFrameSize = { w: 128, h: 128 };
    manifest.animations = [{
      id: "run", name: "run", frameIndices: [0],
      frames: ["animations/run/frames/frame-00001.png"], fps: 12,
      spritesheet: "animations/run/spritesheet.png", previewGif: null,
      createdAt: manifest.createdAt, updatedAt: manifest.updatedAt,
    }];
    await writeManifest(projectId, manifest);

    const view = await runInProject(projectId, () => updateAnimation("run", {
      name: "run", frameIndices: [1], fps: 12,
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    }));

    assert.deepEqual(view.animations[0].frameIndices, [1]);

    const withCopy = await runInProject(projectId, () => createAnimation({
      name: "run-copy", frameIndices: [0, 1], fps: 12,
      dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    }));
    assert.deepEqual(withCopy.animations.find(({ name }) => name === "run-copy")?.frameIndices, [0, 1]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
