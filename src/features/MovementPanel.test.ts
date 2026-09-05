import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState } from "../studio/state";
import MovementPanel from "./MovementPanel.vue";

describe("MovementPanel", () => {
  it("places Generate Video in a full-width primary row", () => {
    const state = createStudioState();
    state.project = { id: "one", spriteUrl: "/sprite.png" } as typeof state.project;
    const studio = reactive({
      state,
      imageModels: [], videoModels: [], projects: [], activePanel: "movement",
      hasApiKey: true,
      actions: { setPanel: vi.fn(), generateVideo: vi.fn() },
    }) as unknown as StudioContext;
    const wrapper = mount(MovementPanel, {
      global: { provide: { [studioKey as symbol]: studio } },
    });
    const button = wrapper.get("button.btn--primary");
    expect(button.classes()).toContain("btn--block");
    expect(button.element.parentElement?.classList.contains("motion-controls")).toBe(false);
  });
});
