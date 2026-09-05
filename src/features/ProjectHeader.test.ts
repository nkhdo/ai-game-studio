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
    activePanel: "reference",
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

  it("places the Project selector beside the app name", () => {
    const wrapper = mount(ProjectHeader, {
      global: { provide: { [studioKey as symbol]: context() } },
    });
    expect(
      wrapper.get(".app-header__brand").find("[data-project-select]").exists(),
    ).toBe(true);
    expect(
      wrapper.find(".app-header__actions").exists(),
    ).toBe(false);
  });

  it("places save feedback beside the Project selector", () => {
    const studio = context();
    studio.state.save.phase = "saving";
    const wrapper = mount(ProjectHeader, {
      global: { provide: { [studioKey as symbol]: studio } },
    });
    const brand = wrapper.get(".app-header__brand");
    expect(brand.get(".save-indicator").text()).toBe("Saving…");
    expect(
      brand.get("[data-project-select]").element.compareDocumentPosition(
        brand.get(".save-indicator").element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
