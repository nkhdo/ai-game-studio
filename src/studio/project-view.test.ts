import { describe, expect, it } from "vitest";
import type { ProjectView } from "../lib/api";
import { hydrateProjectAssets } from "./project-view";

describe("Project asset hydration", () => {
  it("keeps Movement Frame URLs stable across unrelated Project writes", () => {
    const view = {
      frames: ["/projects/one/frames/frame-1.png"],
      framesUpdatedAt: "frames-v1",
      updatedAt: "project-v2",
      styleGuides: [],
      animations: [],
      spriteUrl: null,
      transparentReferencePreviewUrl: null,
      sourceVideoUrl: null,
    } as unknown as ProjectView;

    const before = hydrateProjectAssets(view).frames;
    const after = hydrateProjectAssets({ ...view, updatedAt: "project-v3" }).frames;

    expect(after).toEqual(before);
    expect(after[0]).toContain("v=frames-v1");
  });

  it("does not change hydrated Movement Frame URLs when hydrating again", () => {
    const view = {
      frames: ["/projects/one/frames/frame-1.png"],
      framesUpdatedAt: "frames-v1",
      updatedAt: "project-v2",
      styleGuides: [],
      animations: [],
      spriteUrl: null,
      transparentReferencePreviewUrl: null,
      sourceVideoUrl: null,
    } as unknown as ProjectView;

    const hydrated = hydrateProjectAssets(view);

    expect(hydrateProjectAssets(hydrated).frames).toEqual(hydrated.frames);
  });
});
