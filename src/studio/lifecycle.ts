import { watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { ProjectView } from "../lib/api";
import { routeAnimation, routePanel } from "../router";
import type { StudioContext } from "./context";
import type { StudioDependencies } from "./dependencies";
import type { DraftSynchronizer } from "./draft-sync";
import { mostRecentlyUpdatedProject } from "./project-selection";
import { editAnimation, newAnimationDraft, type StudioState } from "./state";
import { errorMessage } from "./workflows/types";

interface StudioLifecycleOptions {
  router: Router;
  route: RouteLocationNormalizedLoaded;
  state: StudioState;
  context: StudioContext & { ready: boolean; bootError: string };
  dependencies: StudioDependencies;
  sync: DraftSynchronizer;
  apply(view: ProjectView): void;
  openProject(view: ProjectView): Promise<void>;
  refreshProjects(): Promise<void>;
}

export function installStudioLifecycle(options: StudioLifecycleOptions): void {
  const { router, route, state, context, dependencies, sync, apply, openProject, refreshProjects } = options;

  router.beforeEach(async (to) => {
    const target = typeof to.params.projectId === "string" ? to.params.projectId : null;
    if (!state.project || !target || target === state.project.id) return true;
    try { await sync.flush(); return true; } catch { return false; }
  });

  watch(() => route.params.projectId, async (value) => {
    if (!context.ready || typeof value !== "string" || value === state.project?.id) return;
    try {
      apply(await dependencies.server.getProject(value));
      await refreshProjects();
    } catch {
      const fallback = context.projects[0]
        ? await dependencies.server.getProject(context.projects[0].id)
        : await dependencies.server.createProject();
      await openProject(fallback);
    }
  });

  watch(() => [route.query.panel, route.query.animation], () => {
    context.activePanel = routePanel(route);
    const id = routeAnimation(route);
    const animation = state.project?.animations.find((candidate) => candidate.id === id);
    if (animation && state.animationDraft.activeAnimationId !== id) editAnimation(state, animation);
    if (id && !animation) {
      newAnimationDraft(state);
      void router.replace({
        name: "project",
        params: { projectId: state.project?.id },
        query: { panel: context.activePanel },
      });
    }
  });

  void Promise.all([
    dependencies.server.checkHealth(), dependencies.server.listProjects(),
    dependencies.server.getImageModels(), dependencies.server.getVideoModels(),
  ]).then(async ([health, projects, images, videos]) => {
    context.hasApiKey = health.hasApiKey;
    context.projects = projects;
    context.imageModels = [...images.models];
    context.videoModels = [...videos.models];
    const requested = typeof route.params.projectId === "string" ? route.params.projectId : null;
    const recent = mostRecentlyUpdatedProject(projects);
    let view: ProjectView;
    try {
      view = requested
        ? await dependencies.server.getProject(requested)
        : recent ? await dependencies.server.getProject(recent.id) : await dependencies.server.createProject();
    } catch {
      view = recent ? await dependencies.server.getProject(recent.id) : await dependencies.server.createProject();
    }
    apply(view);
    context.activePanel = routePanel(route);
    const animation = view.animations.find(({ id }) => id === routeAnimation(route));
    if (animation) editAnimation(state, animation);
    await router.replace({
      name: "project", params: { projectId: view.id },
      query: { panel: context.activePanel, ...(animation ? { animation: animation.id } : {}) },
    });
    context.ready = true;
  }).catch((error) => {
    context.bootError = errorMessage(error, "Backend not reachable.");
  });
}
