import { computed, reactive, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { ProjectView } from "../lib/api";
import { routeAnimation, routePanel, type LeftPanel } from "../router";
import type { StudioContext } from "./context";
import type { StudioDependencies } from "./dependencies";
import { toServerDraft } from "./draft-persistence";
import { DraftSynchronizer } from "./draft-sync";
import {
  beginOperation,
  createStudioState,
  editAnimation,
  finishOperation,
  newAnimationDraft,
  reconcileProject,
  useStudioProjections,
} from "./state";
import { errorMessage } from "./workflows/types";
import { createAnimationActions } from "./workflows/animation";
import { createMovementActions } from "./workflows/movement";
import { createProjectActions } from "./workflows/projects";
import { createReferenceActions } from "./workflows/reference";
import type { WorkflowEnvironment } from "./workflows/types";

function bust(url: string | null, key: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(key)}`;
}

function cacheBustProject(view: ProjectView): ProjectView {
  return {
    ...view,
    spriteUrl: bust(view.spriteUrl, view.updatedAt),
    sourceVideoUrl: bust(view.sourceVideoUrl, view.updatedAt),
    spritesheetUrl: bust(view.spritesheetUrl, view.updatedAt),
    previewGifUrl: bust(view.previewGifUrl, view.updatedAt),
    frames: view.frames.map((url) => bust(url, view.updatedAt)!),
    styleGuides: view.styleGuides.map((guide) => ({
      ...guide,
      url: bust(guide.url, view.updatedAt)!,
    })),
    animations: view.animations.map((animation) => ({
      ...animation,
      frameUrls: animation.frameUrls.map((url) => bust(url, animation.updatedAt)!),
      spritesheetUrl: bust(animation.spritesheetUrl, animation.updatedAt)!,
      previewGifUrl: bust(animation.previewGifUrl, animation.updatedAt),
    })),
  };
}

export interface StudioController extends StudioContext {
  ready: boolean;
  bootError: string;
  toast: string;
  frameUrls: string[];
}

export function createStudioController(
  router: Router,
  route: RouteLocationNormalizedLoaded,
  dependencies: StudioDependencies,
): StudioController {
  const state = createStudioState();
  const projections = useStudioProjections(state);
  let suppressDraftSave = true;
  let toastTimer: number | null = null;

  const context = reactive({
    state,
    imageModels: [],
    videoModels: [],
    projects: [],
    activePanel: "reference" as LeftPanel,
    hasApiKey: false,
    ready: false,
    bootError: "",
    toast: "",
    frameUrls: computed(() => projections.frameUrls.value),
    actions: {} as StudioContext["actions"],
  }) as unknown as StudioController;

  const sync = new DraftSynchronizer(
    dependencies.clock,
    async (projectId, revision, patch, base) => {
      const view = await dependencies.server.saveProjectDraft(
        { id: projectId, revision },
        toServerDraft(patch),
        toServerDraft(base),
      );
      if (state.project?.id === projectId) {
        state.project.revision = view.revision;
        await refreshProjects();
      }
      return { revision: view.revision };
    },
    700,
    (phase) => {
      state.save.phase = phase;
      state.save.message = phase === "error" ? "Not saved · Retry" : "";
    },
  );

  function notify(value: string) {
    context.toast = value;
    if (toastTimer !== null) dependencies.clock.clearTimeout(toastTimer);
    toastTimer = dependencies.clock.setTimeout(() => { context.toast = ""; }, 2200);
  }

  function apply(view: ProjectView, preserveDraft = false) {
    suppressDraftSave = true;
    const hydrated = cacheBustProject(view);
    reconcileProject(state, hydrated, { preserveDraft });
    if (!preserveDraft) sync.attach(hydrated.id, hydrated.revision, state.draft);
    suppressDraftSave = false;
  }

  async function refreshProjects() {
    context.projects = await dependencies.server.listProjects();
  }

  async function setPanelRoute(panel: LeftPanel, animation?: string | null) {
    if (!state.project) return;
    context.activePanel = panel;
    await router.push({
      name: "project",
      params: { projectId: state.project.id },
      query: { panel, ...(animation ? { animation } : {}) },
    });
  }

  async function run(
    name: Parameters<typeof beginOperation>[1],
    progress: string,
    task: (project: ProjectView) => Promise<ProjectView>,
    success: string,
    options: { preserveDraft?: boolean } = {},
  ) {
    const project = state.project;
    if (!project) return;
    const id = beginOperation(state, name, project.id, progress);
    try {
      const view = await task(project);
      if (!finishOperation(state, name, id, project.id, "success", success)) return;
      apply(view, options.preserveDraft);
      notify(success);
    } catch (error) {
      finishOperation(state, name, id, project.id, "error", errorMessage(error, "Operation failed"));
    }
  }

  const workflowEnvironment: WorkflowEnvironment = {
    state,
    context,
    dependencies,
    sync,
    run,
    apply,
    notify,
    refreshProjects,
    openProject,
    setPanel: setPanelRoute,
  };
  context.actions = {
    setPanel: async (panel) => setPanelRoute(panel, state.animationDraft.activeAnimationId),
    ...createReferenceActions(workflowEnvironment),
    ...createMovementActions(workflowEnvironment),
    ...createAnimationActions(workflowEnvironment),
    ...createProjectActions(workflowEnvironment),
  };

  async function openProject(view: ProjectView) {
    apply(view);
    context.activePanel = "reference";
    await router.push({
      name: "project",
      params: { projectId: view.id },
      query: { panel: context.activePanel },
    });
  }

  watch(
    () => state.draft,
    (draft) => { if (!suppressDraftSave && state.project) sync.update(draft); },
    { deep: true },
  );

  router.beforeEach(async (to) => {
    const target = typeof to.params.projectId === "string" ? to.params.projectId : null;
    if (!state.project || !target || target === state.project.id) return true;
    try {
      await sync.flush();
      return true;
    } catch {
      return false;
    }
  });

  watch(
    () => route.params.projectId,
    async (value) => {
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
    },
  );

  watch(
    () => [route.query.panel, route.query.animation],
    () => {
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
    },
  );

  void Promise.all([
    dependencies.server.checkHealth(),
    dependencies.server.listProjects(),
    dependencies.server.getImageModels(),
    dependencies.server.getVideoModels(),
  ]).then(async ([health, projects, images, videos]) => {
    context.hasApiKey = health.hasApiKey;
    context.projects = projects;
    context.imageModels = [...images.models];
    context.videoModels = [...videos.models];
    const requested = typeof route.params.projectId === "string" ? route.params.projectId : null;
    let view: ProjectView;
    try {
      view = requested
        ? await dependencies.server.getProject(requested)
        : projects[0]
          ? await dependencies.server.getProject(projects[0].id)
          : await dependencies.server.createProject();
    } catch {
      view = projects[0]
        ? await dependencies.server.getProject(projects[0].id)
        : await dependencies.server.createProject();
    }
    apply(view);
    context.activePanel = routePanel(route);
    const animationId = routeAnimation(route);
    const animation = view.animations.find(({ id }) => id === animationId);
    if (animation) editAnimation(state, animation);
    await router.replace({
      name: "project",
      params: { projectId: view.id },
      query: {
        panel: context.activePanel,
        ...(animation ? { animation: animation.id } : {}),
      },
    });
    context.ready = true;
  }).catch((error) => {
    context.bootError = errorMessage(error, "Backend not reachable.");
  });

  return context;
}
