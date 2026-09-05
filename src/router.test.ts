import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { routeAnimation, routeStep } from "./router";

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/project/:projectId", component: { template: "<div />" } }],
  });
}

describe("studio routes", () => {
  it("reads workflow state from query parameters", async () => {
    const subject = router();
    await subject.push("/project/abc?step=frames&animation=walk");
    expect(routeStep(subject.currentRoute.value)).toBe("frames");
    expect(routeAnimation(subject.currentRoute.value)).toBe("walk");
  });

  it("falls back from invalid workflow state", async () => {
    const subject = router();
    await subject.push("/project/abc?step=unknown");
    expect(routeStep(subject.currentRoute.value)).toBe("reference");
    expect(routeAnimation(subject.currentRoute.value)).toBeNull();
  });
});
