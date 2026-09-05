import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type Router,
} from "vue-router";

export const WORKFLOW_STEPS = ["reference", "movement", "frames", "animations"] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export function routeStep(route: RouteLocationNormalized): WorkflowStep {
  const value = Array.isArray(route.query.step) ? route.query.step[0] : route.query.step;
  return WORKFLOW_STEPS.includes(value as WorkflowStep) ? value as WorkflowStep : "reference";
}

export function routeAnimation(route: RouteLocationNormalized): string | null {
  const value = Array.isArray(route.query.animation)
    ? route.query.animation[0]
    : route.query.animation;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createStudioRouter(): Router {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", redirect: { name: "project" } },
      {
        path: "/project/:projectId?",
        name: "project",
        component: () => import("./App.vue"),
      },
      { path: "/:pathMatch(.*)*", redirect: { name: "project" } },
    ],
  });
}
