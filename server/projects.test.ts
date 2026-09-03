import assert from "node:assert/strict";
import test from "node:test";
import { emptyManifest, toView } from "./projects.js";

test("project view exposes the source video when movement frames exist", () => {
  const manifest = emptyManifest();
  assert.equal(toView(manifest).sourceVideoUrl, null);

  manifest.frames = ["frames/frame-00001.png"];
  assert.equal(toView(manifest).sourceVideoUrl, "/projects/latest/source.mp4");
});
