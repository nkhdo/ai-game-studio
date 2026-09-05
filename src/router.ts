import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type Router,
} from "vue-router";

export const LEFT_PANELS = ["reference", "movement", "frames"] as const;
export type LeftPanel = (typeof LEFT_PANELS)[number];

export function routePanel(route: RouteLocationNormalized): LeftPanel {
  const value = Array.isArray(route.query.panel) ? route.query.panel[0] : route.query.panel;
  return LEFT_PANELS.includes(value as LeftPanel) ? value as LeftPanel : "reference";
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
