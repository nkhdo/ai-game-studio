import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState } from "../studio/state";
import FramesPanel from "./FramesPanel.vue";

describe("FramesPanel", () => {
  it("uses a full-width primary Generate Frames action", () => {
    const state = createStudioState();
    state.project = { id: "one", sourceVideoUrl: "/source.mp4" } as typeof state.project;
    const studio = reactive({
      state,
      imageModels: [], videoModels: [], projects: [], activePanel: "frames",
      hasApiKey: true,
      actions: { setPanel: vi.fn(), generateFrames: vi.fn() },
    }) as unknown as StudioContext;
    const wrapper = mount(FramesPanel, {
      global: { provide: { [studioKey as symbol]: studio } },
    });
    const button = wrapper.get("button.btn--primary");
    expect(button.text()).toBe("Generate Frames");
    expect(button.classes()).toContain("btn--block");
  });
});
