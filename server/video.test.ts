import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDurationFor,
  isVideoModelId,
  VIDEO_MODELS,
} from "./video.js";

test("registers the Seedance 2.0 Mini and Seedance 2.5 video models", () => {
  assert.deepEqual(
    VIDEO_MODELS.filter(({ id }) =>
      ["bytedance/seedance-2.0-mini", "bytedance/seedance-2.5"].includes(id),
    ),
    [
      {
        id: "bytedance/seedance-2.0-mini",
        label: "Seedance 2.0 Mini",
        defaultDuration: 4,
      },
      {
        id: "bytedance/seedance-2.5",
        label: "Seedance 2.5",
        defaultDuration: 4,
      },
    ],
  );
});

test("accepts the new Seedance ids and resolves their default durations", () => {
  for (const id of ["bytedance/seedance-2.0-mini", "bytedance/seedance-2.5"] as const) {
    assert.equal(isVideoModelId(id), true);
    assert.equal(defaultDurationFor(id), 4);
  }
});
