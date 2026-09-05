import { describe, expect, it } from "vitest";
import type { ProjectView } from "../lib/api";
import {
  beginOperation,
  createStudioState,
  finishOperation,
  reconcileProject,
  toggleFrame,
} from "./state";

function project(id = "one"): ProjectView {
  return {
    id, label: id, createdAt: "", revision: 1,
    spriteAcquisitionMode: "generate", draftFrameSize: 128,
    draftSubjectFillPct: 70, draftColorCount: 16,
    animationDraftName: "", animationDraftFps: 12, spritePrompt: "",
    spriteModel: "image", styleGuides: [], styleGuidesChanged: false,
    spritePaletteLock: false, spriteAcquisition: null,
    spriteOriginalFilename: null, backgroundSuitability: "unknown",
    motionPrompt: "", motionModel: "video", paletteLock: false,
    hardAlphaEdges: false, preservedOffPalettePixels: null,
    removedLowAlphaPixels: null, removedChromaFringePixels: null,
    spriteUrl: null, spriteDimensions: null, targetFrameSize: null,
    subjectFillPct: null, colorCount: null, subjectFillMeasured: null,
    frames: ["one.png", "two.png", "three.png"], selectedFrameIndices: [],
    sourceVideoUrl: null, spritesheetUrl: null, previewGifUrl: null,
    animations: [], updatedAt: "",
  };
}

describe("studio transitions", () => {
  it("rejects a stale operation result after switching Projects", () => {
    const state = createStudioState();
    reconcileProject(state, project("one"));
    const operation = beginOperation(state, "video", "one", "Generating");
    reconcileProject(state, project("two"));
    expect(finishOperation(state, "video", operation, "one", "success", "Done")).toBe(false);
  });

  it("keeps a Frame Sequence ordered while toggling", () => {
    const state = createStudioState();
    toggleFrame(state, 2);
    toggleFrame(state, 0);
    toggleFrame(state, 1);
    expect(state.animationDraft.frameSequence).toEqual([0, 1, 2]);
    toggleFrame(state, 1);
    expect(state.animationDraft.frameSequence).toEqual([0, 2]);
  });

  it("keeps confirmed movement settings separate from editable drafts", () => {
    const state = createStudioState();
    const confirmed = project();
    confirmed.motionPrompt = "jump";
    confirmed.sourceVideoUrl = "/projects/one/source.mp4";
    reconcileProject(state, confirmed);
    state.draft.motionPrompt = "attack right";
    expect(state.project?.motionPrompt).toBe("jump");
    expect(state.draft.motionPrompt).toBe("attack right");
    expect(state.project?.sourceVideoUrl).toBe("/projects/one/source.mp4");
  });

  it("does not overwrite an in-progress draft when reconciliation preserves it", () => {
    const state = createStudioState();
    reconcileProject(state, project());
    state.draft.spriteAcquisitionMode = "upload";
    reconcileProject(state, { ...project(), revision: 2 }, { preserveDraft: true });
    expect(state.draft.spriteAcquisitionMode).toBe("upload");
  });
});
