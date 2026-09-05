import { DOMWrapper, enableAutoUnmount, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState } from "../studio/state";
import AnimationWorkspace from "./AnimationWorkspace.vue";
enableAutoUnmount(afterEach);

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
      toggleFrame: vi.fn(),
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
    const toggle = wrapper.get('[aria-label="More save actions"]');
    await toggle.trigger("click");
    expect(studio.actions.saveAnimation).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(document.querySelector('.ui-dropdown__item')).not.toBeNull());
    await new DOMWrapper(document.querySelector('.ui-dropdown__item')!).trigger("click");
    expect(studio.actions.saveAnimation).toHaveBeenLastCalledWith(false);
    expect(toggle.attributes("aria-expanded")).toBe("false");
  });

  it("places compact Animation settings and save actions in the preview header", () => {
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: context() } },
    });

    const actions = wrapper.get(".quick-preview__header-actions");
    expect(actions.get('input[placeholder="e.g., run"]').element.tagName).toBe("INPUT");
    expect(actions.get('input[type="number"]').attributes("max")).toBe("60");
    expect(actions.findAll(".animation-save-split .btn").map((button) => button.text())).toEqual(["Save", ""]);
    expect(actions.get('[aria-label="More save actions"] svg').attributes("data-icon")).toBe("chevron-down");
    expect(wrapper.find(".quick-preview__overlay--settings").exists()).toBe(false);
    expect(wrapper.find(".animation-editor__header").exists()).toBe(false);
  });

  it("disables both save controls without frames and while saving", async () => {
    const studio = context();
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: studio } },
    });
    const buttons = wrapper.findAll<HTMLButtonElement>(".animation-save-split button");
    expect(buttons.every((button) => button.element.disabled)).toBe(true);
    studio.frameUrls = ["one.png"];
    await wrapper.vm.$nextTick();
    await buttons[1]!.trigger("click");
    expect(buttons[1]!.attributes("aria-expanded")).toBe("true");
    studio.state.operations.animation.phase = "running";
    await wrapper.vm.$nextTick();
    expect(buttons.every((button) => button.element.disabled)).toBe(true);
    expect(buttons[1]!.attributes("aria-expanded")).toBe("false");
  });

  it.each(["mouseenter", "focus"])("previews the original frame on %s without selecting it", async (event) => {
    const studio = context();
    studio.state.project!.frames = ["/projects/one/frames/0.png"];
    const wrapper = mount(AnimationWorkspace, {
      attachTo: document.body,
      global: { provide: { [studioKey as symbol]: studio } },
    });
    await wrapper.vm.$nextTick();
    const gridBounds = vi.spyOn(wrapper.get(".frames-grid").element, "getBoundingClientRect");
    const tile = wrapper.get(".frame-tile");
    await tile.trigger(event);
    await vi.waitFor(() => expect(document.querySelector('.v-popper__popper--shown .frame-preview img')?.getAttribute("src"))
      .toBe("/projects/one/frames/0.png"));
    expect(gridBounds).toHaveBeenCalled();
    expect(studio.actions.toggleFrame).not.toHaveBeenCalled();
    expect(wrapper.find(".frame-preview").exists()).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.v-popper__popper--shown .frame-preview')).toBeNull());
    await tile.trigger("click");
    expect(studio.actions.toggleFrame).toHaveBeenCalledWith(0);
  });

  it("keeps one preview open across fast frame changes, then hides after the grace period", async () => {
    vi.useFakeTimers();
    const studio = context();
    studio.state.project!.frames = ["/first.png", "/second.png"];
    const wrapper = mount(AnimationWorkspace, {
      attachTo: document.body,
      global: { provide: { [studioKey as symbol]: studio } },
    });
    try {
      const tiles = wrapper.findAll(".frame-tile");
      const shownImage = () => document.querySelector('.v-popper__popper--shown .frame-preview img');
      await tiles[0]!.trigger("mouseenter");
      await vi.advanceTimersByTimeAsync(499);
      expect(shownImage()).toBeNull();
      await vi.advanceTimersByTimeAsync(101);
      const image = shownImage();
      expect(image?.getAttribute("src")).toBe("/first.png");
      expect(document.querySelector(".frame-preview__label")?.textContent).toBe("Frame 1");

      await tiles[0]!.trigger("mousedown");
      await tiles[0]!.trigger("focus");
      await tiles[0]!.trigger("click");
      await vi.advanceTimersByTimeAsync(100);
      expect(studio.actions.toggleFrame).toHaveBeenCalledWith(0);
      expect(shownImage()).toBe(image);

      await tiles[0]!.trigger("mouseleave");
      await vi.advanceTimersByTimeAsync(50);
      expect(shownImage()).toBe(image);
      await tiles[1]!.trigger("mouseenter");
      expect(shownImage()).toBe(image);
      expect(image?.getAttribute("src")).toBe("/second.png");
      expect(document.querySelector(".frame-preview__label")?.textContent).toBe("Frame 2");
      await vi.advanceTimersByTimeAsync(600);
      expect(shownImage()).toBe(image);
      expect(document.querySelectorAll(".frame-preview")).toHaveLength(1);

      await tiles[1]!.trigger("mouseleave");
      await vi.advanceTimersByTimeAsync(99);
      expect(shownImage()).toBe(image);
      await vi.advanceTimersByTimeAsync(101);
      expect(shownImage()).toBeNull();
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });

  it("cancels a pending preview when leaving a frame or collapsing the selector", async () => {
    vi.useFakeTimers();
    const studio = context();
    studio.state.project!.frames = ["/first.png"];
    const wrapper = mount(AnimationWorkspace, {
      global: { provide: { [studioKey as symbol]: studio } },
    });
    try {
      const tile = wrapper.get(".frame-tile");
      await tile.trigger("mouseenter");
      await vi.advanceTimersByTimeAsync(200);
      await tile.trigger("mouseleave");
      await vi.advanceTimersByTimeAsync(600);
      expect(document.querySelector('.v-popper__popper--shown .frame-preview')).toBeNull();

      await tile.trigger("mouseenter");
      await wrapper.get('[aria-label="Expand preview"]').trigger("click");
      await vi.advanceTimersByTimeAsync(600);
      expect(document.querySelector('.v-popper__popper--shown .frame-preview')).toBeNull();
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
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
