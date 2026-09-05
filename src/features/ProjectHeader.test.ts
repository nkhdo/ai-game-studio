import { DOMWrapper, enableAutoUnmount, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState } from "../studio/state";
import ProjectHeader from "./ProjectHeader.vue";
import { setTheme, THEME_STORAGE_KEY } from "../theme";
enableAutoUnmount(afterEach);

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
    projects: [{ id: "one", label: "Ladybug boss", createdAt: "", updatedAt: "" }],
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
    expect(wrapper.get(".app-header__actions").find(".theme-toggle").exists()).toBe(true);
  });

  it("toggles and persists dark mode from the navbar", async () => {
    setTheme("light", false);
    const wrapper = mount(ProjectHeader, {
      global: { provide: { [studioKey as symbol]: context() } },
    });
    const toggle = wrapper.get(".theme-toggle");

    expect(toggle.attributes("aria-label")).toBe("Dark mode");
    expect(toggle.attributes("aria-pressed")).toBe("false");
    expect(toggle.get("svg").attributes("data-icon")).toBe("moon");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-pressed")).toBe("true");
    expect(toggle.get("svg").attributes("data-icon")).toBe("sun");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
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

  it("supports keyboard menu navigation and Escape focus return", async () => {
    const wrapper = mount(ProjectHeader, {
      attachTo: document.body,
      global: { provide: { [studioKey as symbol]: context() } },
    });
    const trigger = wrapper.get<HTMLButtonElement>("[data-project-select]");
    await trigger.trigger("keydown", { key: "ArrowDown" });
    expect(trigger.attributes("aria-expanded")).toBe("true");
    await vi.waitFor(() => expect(document.activeElement?.getAttribute("role")).toBe("menuitem"));
    const menu = new DOMWrapper(document.querySelector(".load-menu")!);
    expect(wrapper.element.contains(menu.element)).toBe(false);
    await menu.trigger("keydown", { key: "End" });
    expect(document.activeElement?.textContent).toContain("Create new");
    await menu.trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Ladybug boss");
    await menu.trigger("keydown", { key: "Escape" });
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();
  });

  it("closes the Project menu after an outside pointer action", async () => {
    const wrapper = mount(ProjectHeader, {
      attachTo: document.body,
      global: { provide: { [studioKey as symbol]: context() } },
    });
    await wrapper.get("[data-project-select]").trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-project-select]").attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });
});
