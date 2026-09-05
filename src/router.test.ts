import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { routeAnimation, routePanel } from "./router";

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/project/:projectId", component: { template: "<div />" } }],
  });
}

describe("studio routes", () => {
  it.each(["reference", "movement", "frames"] as const)(
    "accepts the %s left panel",
    async (panel) => {
      const subject = router();
      await subject.push(`/project/abc?panel=${panel}`);
      expect(routePanel(subject.currentRoute.value)).toBe(panel);
    },
  );

  it("reads workflow state from query parameters", async () => {
    const subject = router();
    await subject.push("/project/abc?panel=frames&animation=walk");
    expect(routePanel(subject.currentRoute.value)).toBe("frames");
    expect(routeAnimation(subject.currentRoute.value)).toBe("walk");
  });

  it("falls back from invalid workflow state", async () => {
    const subject = router();
    await subject.push("/project/abc?panel=unknown");
    expect(routePanel(subject.currentRoute.value)).toBe("reference");
    expect(routeAnimation(subject.currentRoute.value)).toBeNull();
  });

  it("defaults the left panel to Reference Sprite Acquisition", async () => {
    const subject = router();
    await subject.push("/project/abc?step=frames&animation=walk");
    expect(routePanel(subject.currentRoute.value)).toBe("reference");
  });
});
