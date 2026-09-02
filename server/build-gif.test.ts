import assert from "node:assert/strict";
import test from "node:test";
import { previewGifFilter } from "./build-gif.js";

test("animated preview uses the target frame dimensions", () => {
  assert.match(previewGifFilter(64), /^scale=64:64:/);
  assert.match(previewGifFilter(256), /^scale=256:256:/);
});
