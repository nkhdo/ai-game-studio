import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, hydrateFromView } from "../src/lib/state.js";
import { emptyManifest, toView } from "./projects.js";

test("a generated video is available before movement frames exist", () => {
  const manifest = emptyManifest();
  manifest.motionPrompt = "walk left";
  manifest.motionModel = "x-ai/grok-imagine-video";
  manifest.sourceVideo = "source.mp4";

  const patch = hydrateFromView(toView(manifest));

  assert.match(patch.motionVideoSrc ?? "", new RegExp(`/projects/${manifest.id}/source\\.mp4`));
  assert.deepEqual(patch.frames, []);
  assert.equal(patch.appliedMotionPrompt, "walk left");
  assert.equal(patch.appliedMotionModel, "x-ai/grok-imagine-video");
});

test("draft and applied movement settings start aligned but can diverge locally", () => {
  const manifest = emptyManifest();
  manifest.motionPrompt = "jump";
  manifest.sourceVideo = "source.mp4";
  const state = { ...createInitialState(), ...hydrateFromView(toView(manifest)) };

  assert.equal(state.motionPrompt, state.appliedMotionPrompt);
  state.motionPrompt = "attack right";
  assert.notEqual(state.motionPrompt, state.appliedMotionPrompt);
});
