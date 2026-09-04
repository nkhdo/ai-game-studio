import assert from "node:assert/strict";
import test from "node:test";
import { parseNavigation, withNavigation } from "../src/lib/navigation.js";
import { createInitialState, hydrateFromView } from "../src/lib/state.js";
import { emptyManifest, toView } from "./projects.js";

test("navigation parses owned project and workflow step parameters", () => {
  assert.deepEqual(
    parseNavigation(new URL("https://studio.test/?project=knight&step=motion")),
    { project: "knight", step: "motion", animation: null },
  );
  assert.deepEqual(
    parseNavigation(new URL("https://studio.test/?project=knight&step=unknown")),
    { project: "knight", step: null, animation: null },
  );
});

test("navigation updates owned parameters without dropping unknown ones", () => {
  const url = withNavigation(
    new URL("https://studio.test/?campaign=demo&project=old"),
    { project: "new", step: "frames", animation: "run-id" },
  );
  assert.equal(url.searchParams.get("campaign"), "demo");
  assert.equal(url.searchParams.get("project"), "new");
  assert.equal(url.searchParams.get("step"), "frames");
  assert.equal(url.searchParams.get("animation"), "run-id");
});

test("project hydration does not overwrite the user's acquisition tab", () => {
  const manifest = emptyManifest();
  manifest.spriteAcquisition = "uploaded";
  const state = {
    ...createInitialState(),
    spriteAcquisitionMode: "generate" as const,
    ...hydrateFromView(toView(manifest)),
  };
  assert.equal(state.spriteAcquisition, "uploaded");
  assert.equal(state.spriteAcquisitionMode, "generate");
});
