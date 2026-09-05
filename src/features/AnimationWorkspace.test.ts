import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState } from "../studio/state";
import AnimationWorkspace from "./AnimationWorkspace.vue";

function context(): StudioContext {
  const state = createStudioState();
  state.project = { id: "one", animations: [], frames: [] } as unknown as typeof state.project;
  return reactive({
    state,
    imageModels: [],
    videoModels: [],
    projects: [],
    activePanel: "reference",
    hasApiKey: true,
    frameUrls: [],
    actions: {
      selectAll: vi.fn(),
      selectNone: vi.fn(),
      activateAnimation: vi.fn(),
      saveAnimation: vi.fn(),
    },
  }) as unknown as StudioContext;
}

describe("AnimationWorkspace", () => {
  it("opens a saved Animation by clicking its row without an Edit button", async () => {
    const studio = context();
    studio.state.project!.animations = [{
      id: "walk",
      name: "Walk",
      frameUrls: ["/frame.png"],
      frameIndices: [0],
      fps: 12,
      spritesheetUrl: "/sheet.png",
      previewGifUrl: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }];
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: studio } },
    });

    expect(wrapper.text()).not.toContain("Edit");
    await wrapper.get(".animation-row__select").trigger("click");
    expect(studio.actions.activateAnimation).toHaveBeenCalledWith("walk");
  });

  it("uses contained SVG controls for zoom and playback", async () => {
    const studio = context();
    studio.frameUrls = ["one.png", "two.png", "three.png"];
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: studio } },
    });
    expect(wrapper.find(".quick-preview__position").exists()).toBe(true);
    expect(wrapper.get(".quick-preview__zoom").text()).toBe("100%");
    expect(wrapper.find('[aria-label="Zoom out"] svg').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Zoom in"] svg').exists()).toBe(true);
    expect(wrapper.get('[aria-label="Play preview"] svg').attributes("data-icon")).toBe("play");
    await wrapper.get('[aria-label="Play preview"]').trigger("click");
    expect(wrapper.get('[aria-label="Pause preview"] svg').attributes("data-icon")).toBe("pause");
    await wrapper.get('[aria-label="Next frame"]').trigger("click");
    expect(wrapper.get(".quick-preview__position").text()).toBe("2 / 3");
    expect(wrapper.get('[aria-label="Play preview"] svg').attributes("data-icon")).toBe("play");
    await wrapper.get('[aria-label="Previous frame"]').trigger("click");
    expect(wrapper.get(".quick-preview__position").text()).toBe("1 / 3");
  });

  it("uses Save for the active Animation and Save as for a new copy", async () => {
    const studio = context();
    studio.frameUrls = ["one.png"];
    studio.state.animationDraft.activeAnimationId = "walk";
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: studio } },
    });

    await wrapper.get(".animation-save-split .btn--primary").trigger("click");
    expect(studio.actions.saveAnimation).toHaveBeenCalledWith(true);
    await wrapper.get(".animation-save-split .btn--secondary").trigger("click");
    expect(studio.actions.saveAnimation).toHaveBeenLastCalledWith(false);
  });

  it("places compact Animation settings in the preview overlay", () => {
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: context() } },
    });

    const settings = wrapper.get(".quick-preview__overlay--settings");
    expect(settings.get('input[placeholder="e.g., run"]').element.tagName).toBe("INPUT");
    expect(settings.get('input[type="number"]').attributes("max")).toBe("60");
    expect(wrapper.find(".animation-editor__header").exists()).toBe(false);
  });
});
