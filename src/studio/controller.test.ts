import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vitest";
import type { ProjectMutation, ProjectView } from "../lib/api";
import { createStudioController } from "./controller";
import type { StudioDependencies } from "./dependencies";

function project(): ProjectView {
  return {
    id: "project-one", label: "One", createdAt: "", revision: 1,
    spriteAcquisitionMode: "generate", draftFrameSize: 128,
    draftSubjectFillPct: 70, draftColorCount: 16, animationDraftName: "",
    animationDraftFps: 12, spritePrompt: "", spriteModel: "image",
    styleGuides: [], styleGuidesChanged: false, spritePaletteLock: false,
    spriteAcquisition: "generated", spriteOriginalFilename: null,
    backgroundSuitability: "suitable", motionPrompt: "walk", motionModel: "video",
    paletteLock: false, hardAlphaEdges: false, preservedOffPalettePixels: null,
    removedLowAlphaPixels: null, removedChromaFringePixels: null,
    spriteUrl: "/sprite.png", transparentReferencePreviewUrl: "/preview.png",
    spriteDimensions: { w: 128, h: 128 }, targetFrameSize: { w: 128, h: 128 },
    subjectFillPct: 70, colorCount: 16, subjectFillMeasured: 70,
    frames: [], framesUpdatedAt: "", sourceVideoUrl: "/source.mp4",
    animations: [], updatedAt: "",
  };
}

describe("StudioController immediate writes", () => {
  it("waits for a pending draft save before capturing the Project revision", async () => {
    const view = project();
    let runDraftTimer: (() => void) | undefined;
    let finishDraftSave!: (mutation: ProjectMutation) => void;
    const draftSave = new Promise<ProjectMutation>((resolve) => { finishDraftSave = resolve; });
    const generateMovementFrames = vi.fn(async (context: { revision: number }) => {
      if (context.revision !== 2) {
        throw new Error("project changed in another tab; reload before retrying");
      }
      return { revision: 3, updatedAt: "frames", changes: { frames: ["/frame.png"] } };
    });
    const server = {
      checkHealth: vi.fn().mockResolvedValue({ ok: true, hasApiKey: true }),
      listProjects: vi.fn().mockResolvedValue([{ id: view.id, label: view.label, createdAt: "", updatedAt: "" }]),
      getImageModels: vi.fn().mockResolvedValue({ models: [], default: "image" }),
      getVideoModels: vi.fn().mockResolvedValue({ models: [], default: "video" }),
      getProject: vi.fn().mockResolvedValue(view),
      saveProjectDraft: vi.fn(() => draftSave),
      generateMovementFrames,
    };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/project/:projectId?", name: "project", component: { template: "<div />" } }],
    });
    await router.push("/project/project-one?panel=frames");
    const controller = createStudioController(router, router.currentRoute.value, {
      server,
      clock: {
        setTimeout(callback: () => void) { runDraftTimer = callback; return 1; },
        clearTimeout() { runDraftTimer = undefined; },
      },
      confirmation: { confirm: vi.fn(), prompt: vi.fn() },
    } as unknown as StudioDependencies);
    await flushPromises();

    controller.state.draft.paletteLock = true;
    await flushPromises();
    runDraftTimer?.();
    await Promise.resolve();
    expect(server.saveProjectDraft).toHaveBeenCalledOnce();

    const generation = controller.actions.generateFrames();
    await Promise.resolve();
    expect(generateMovementFrames).not.toHaveBeenCalled();

    finishDraftSave({ revision: 2, updatedAt: "draft", changes: { paletteLock: true } });
    await generation;
    expect(generateMovementFrames).toHaveBeenCalledWith(
      expect.objectContaining({ id: view.id, revision: 2 }), true, false,
    );
    expect(controller.state.operations.frames.phase).toBe("success");
  });
});
