import { computed, reactive, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { ProjectMutation, ProjectView } from "../lib/api";
import type { LeftPanel } from "../router";
import type { StudioContext } from "./context";
import type { StudioDependencies } from "./dependencies";
import { toServerDraft } from "./draft-persistence";
import { DraftSynchronizer } from "./draft-sync";
import { hydrateProjectAssets } from "./project-view";
import { installStudioLifecycle } from "./lifecycle";
import {
  beginOperation,
  createStudioState,
  finishOperation,
  reconcileProject,
  useStudioProjections,
} from "./state";
import { errorMessage, mergeMutation } from "./workflows/types";
import { createAnimationActions } from "./workflows/animation";
import { createMovementActions } from "./workflows/movement";
import { createProjectActions } from "./workflows/projects";
import { createReferenceActions } from "./workflows/reference";
import type { WorkflowEnvironment } from "./workflows/types";

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
      const mutation = await dependencies.server.saveProjectDraft(
        { id: projectId, revision },
        toServerDraft(patch),
        toServerDraft(base),
      );
      if (state.project?.id === projectId) {
        state.project.revision = mutation.revision;
        state.project.updatedAt = mutation.updatedAt;
        await refreshProjects();
      }
      return { revision: mutation.revision };
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
    const hydrated = hydrateProjectAssets(view);
    reconcileProject(state, hydrated, { preserveDraft });
    if (!preserveDraft) sync.attach(hydrated.id, hydrated.revision, state.draft);
    suppressDraftSave = false;
  }

  function applyMutation(project: ProjectView, mutation: ProjectMutation, preserveDraft = true) {
    if (state.project?.id !== project.id) return;
    apply(mergeMutation(project, mutation), preserveDraft);
    sync.advanceRevision(project.id, mutation.revision);
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
    task: (project: ProjectView) => Promise<ProjectMutation>,
    success: string,
    options: { preserveDraft?: boolean } = {},
  ) {
    const project = state.project;
    if (!project) return;
    const id = beginOperation(state, name, project.id, progress);
    try {
      const mutation = await task(project);
      if (!finishOperation(state, name, id, project.id, "success", success)) return;
      applyMutation(project, mutation, options.preserveDraft);
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
    applyMutation,
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

  installStudioLifecycle({
    router, route, state, context, dependencies, sync, apply, openProject, refreshProjects,
  });

  return context;
}
