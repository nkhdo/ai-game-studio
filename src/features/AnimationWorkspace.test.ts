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

  it("places compact Animation settings and save actions in the preview header", () => {
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: context() } },
    });

    const actions = wrapper.get(".quick-preview__header-actions");
    expect(actions.get('input[placeholder="e.g., run"]').element.tagName).toBe("INPUT");
    expect(actions.get('input[type="number"]').attributes("max")).toBe("60");
    expect(actions.findAll(".animation-save-split .btn").map((button) => button.text())).toEqual(["Save", "Save as"]);
    expect(wrapper.find(".quick-preview__overlay--settings").exists()).toBe(false);
    expect(wrapper.find(".animation-editor__header").exists()).toBe(false);
  });

  it("expands the preview by hiding and restoring the frame selector", async () => {
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: context() } },
    });

    await wrapper.get('[aria-label="Expand preview"]').trigger("click");
    expect(wrapper.get(".animation-edit-pane").classes()).toContain("is-preview-expanded");
    expect(wrapper.get('[aria-label="Collapse preview"] svg').attributes("data-icon")).toBe("collapse");

    await wrapper.get('[aria-label="Collapse preview"]').trigger("click");
    expect(wrapper.get(".animation-edit-pane").classes()).not.toContain("is-preview-expanded");
    expect(wrapper.get('[aria-label="Expand preview"] svg').attributes("data-icon")).toBe("expand");
  });

  it("groups preview controls in playback, zoom, navigation, and expansion order", () => {
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: context() } },
    });
    const groups = wrapper.findAll(".quick-preview__control-group");

    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.findAll("button").map((button) => button.attributes("aria-label")))).toEqual([
      ["Play preview"],
      ["Zoom in", "Reset zoom", "Zoom out"],
      ["Previous frame", "Next frame"],
      ["Expand preview"],
    ]);
  });
});
