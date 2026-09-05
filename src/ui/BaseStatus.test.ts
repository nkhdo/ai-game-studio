import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import BaseStatus from "./BaseStatus.vue";

describe("BaseStatus", () => {
  it("announces errors and renders busy state accessibly", () => {
    const wrapper = mount(BaseStatus, {
      props: { message: "Generation failed", kind: "error", busy: true },
    });
    expect(wrapper.attributes("role")).toBe("alert");
    expect(wrapper.text()).toContain("Generation failed");
    expect(wrapper.find(".spinner").attributes("aria-hidden")).toBe("true");
  });
});
