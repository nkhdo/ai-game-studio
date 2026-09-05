import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import type { ProjectView } from "./lib/api";

const view = vi.hoisted(() => ({
  id: "project-one", label: "Knight", createdAt: "2026-01-01T00:00:00Z", revision: 1,
  spriteAcquisitionMode: "generate", draftFrameSize: 128, draftSubjectFillPct: 70,
  draftColorCount: 16, animationDraftName: "", animationDraftFps: 12,
  spritePrompt: "knight", spriteModel: "image", styleGuides: [],
  styleGuidesChanged: false, spritePaletteLock: false, spriteAcquisition: null,
  spriteOriginalFilename: null, backgroundSuitability: "unknown", motionPrompt: "",
  motionModel: "video", paletteLock: false, hardAlphaEdges: false,
  preservedOffPalettePixels: null, removedLowAlphaPixels: null,
  removedChromaFringePixels: null, spriteUrl: null, spriteDimensions: null,
  targetFrameSize: null, subjectFillPct: null, colorCount: null,
  subjectFillMeasured: null, frames: [], selectedFrameIndices: [],
  sourceVideoUrl: null, spritesheetUrl: null, previewGifUrl: null,
  animations: [], updatedAt: "2026-01-01T00:00:00Z",
} satisfies ProjectView));

vi.mock("./lib/api", () => ({
  checkHealth: vi.fn().mockResolvedValue({ ok: true, hasApiKey: true }),
  listProjects: vi.fn().mockResolvedValue([{ id: view.id, label: view.label, createdAt: view.createdAt, updatedAt: view.updatedAt }]),
  getImageModels: vi.fn().mockResolvedValue({ models: [{ id: "image", label: "Image", maxStyleGuideImages: 3, sizeStrategy: "target-size" }], default: "image" }),
  getVideoModels: vi.fn().mockResolvedValue({ models: [{ id: "video", label: "Video", defaultDuration: 2, inputMode: "first-frame", minInputWidth: null, minInputHeight: null, inputResizeKernel: "nearest", constraintNote: null }], default: "video" }),
  getProject: vi.fn().mockResolvedValue(view),
  createProject: vi.fn().mockResolvedValue(view),
  setActiveProject: vi.fn(),
  saveProjectDraftFor: vi.fn().mockResolvedValue(view),
  saveSelectionFor: vi.fn().mockResolvedValue(view),
}));

describe("App", () => {
  it("boots the Project route and renders every workflow domain", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/project/:projectId?", name: "project", component: App }],
    });
    await router.push("/project/project-one?panel=reference");
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();
    expect(wrapper.text()).toContain("Choose Reference Sprite");
    expect(wrapper.text()).toContain("Generate Video");
    expect(wrapper.text()).toContain("Generate Frames");
    expect(wrapper.text()).toContain("Animations");
    expect(wrapper.get<HTMLTextAreaElement>("#sprite-prompt").element.value).toBe("knight");
  });
});
