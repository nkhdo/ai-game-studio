import assert from "node:assert/strict";
import test from "node:test";
import { emptyManifest, toView } from "./projects.js";

test("project view exposes the source video when movement frames exist", () => {
  const manifest = emptyManifest();
  assert.equal(toView(manifest).sourceVideoUrl, null);

  manifest.frames = ["frames/frame-00001.png"];
  assert.equal(toView(manifest).sourceVideoUrl, "/projects/latest/source.mp4");
});

test("style match defaults off and round-trips through the view", () => {
  const manifest = emptyManifest();
  assert.equal(manifest.styleMatchReference, false);
  assert.equal(toView(manifest).styleMatchReference, false);

  manifest.styleMatchReference = true;
  assert.equal(toView(manifest).styleMatchReference, true);
});
