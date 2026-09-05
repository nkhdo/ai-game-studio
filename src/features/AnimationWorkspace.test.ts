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
  it("uses contained SVG controls for zoom and playback", async () => {
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: context() } },
    });
    expect(wrapper.find(".quick-preview__position").exists()).toBe(true);
    expect(wrapper.get(".quick-preview__zoom").text()).toBe("100%");
    expect(wrapper.find('[aria-label="Zoom out"] svg').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Zoom in"] svg').exists()).toBe(true);
    expect(wrapper.get('[aria-label="Play preview"] svg').attributes("data-icon")).toBe("play");
    await wrapper.get('[aria-label="Play preview"]').trigger("click");
    expect(wrapper.get('[aria-label="Pause preview"] svg').attributes("data-icon")).toBe("pause");
  });
});
