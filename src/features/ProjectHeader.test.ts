import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState } from "../studio/state";
import ProjectHeader from "./ProjectHeader.vue";

function context(): StudioContext {
  const state = createStudioState();
  state.project = {
    id: "one",
    label: "Ladybug boss",
    createdAt: "",
    revision: 1,
  } as StudioContext["state"]["project"];
  return reactive({
    state,
    imageModels: [],
    videoModels: [],
    projects: [],
    activeStep: "reference",
    hasApiKey: true,
    actions: { retrySave: vi.fn() },
  }) as unknown as StudioContext;
}

describe("ProjectHeader", () => {
  it("renders a sized chevron that follows the dropdown state", async () => {
    const wrapper = mount(ProjectHeader, {
      global: { provide: { [studioKey as symbol]: context() } },
    });
    const trigger = wrapper.get("[data-project-select]");
    const chevron = trigger.get("[data-project-chevron]");
    expect(chevron.element.tagName).toBe("svg");
    expect(chevron.classes()).not.toContain("is-open");
    await trigger.trigger("click");
    expect(chevron.classes()).toContain("is-open");
  });
});
