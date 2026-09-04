import assert from "node:assert/strict";
import test from "node:test";
import { emptyManifest, toView } from "./projects.js";

test("project view exposes the source video when movement frames exist", () => {
  const manifest = emptyManifest();
  assert.equal(toView(manifest).sourceVideoUrl, null);

  manifest.frames = ["frames/frame-00001.png"];
  assert.equal(toView(manifest).sourceVideoUrl, "/projects/latest/source.mp4");
});

test("sprite palette lock defaults off and round-trips through the view", () => {
  const manifest = emptyManifest();
  assert.equal(manifest.spritePaletteLock, false);
  assert.equal(toView(manifest).spritePaletteLock, false);

  manifest.spritePaletteLock = true;
  assert.equal(toView(manifest).spritePaletteLock, true);
});

test("frame cleanup fields default safely and round-trip through the view", () => {
  const manifest = emptyManifest();
  assert.equal(manifest.hardAlphaEdges, false);
  assert.equal(manifest.preservedOffPalettePixels, null);
  assert.equal(manifest.removedLowAlphaPixels, null);
  assert.equal(manifest.removedChromaFringePixels, null);

  manifest.hardAlphaEdges = true;
  manifest.preservedOffPalettePixels = 42;
  manifest.removedLowAlphaPixels = 7;
  manifest.removedChromaFringePixels = 3;
  const view = toView(manifest);
  assert.equal(view.hardAlphaEdges, true);
  assert.equal(view.preservedOffPalettePixels, 42);
  assert.equal(view.removedLowAlphaPixels, 7);
  assert.equal(view.removedChromaFringePixels, 3);
});
