import { computed, reactive, watch } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import {
  saveProjectDraftFor,
  saveSelectionFor,
  setActiveProject,
  type ProjectView,
} from "../lib/api";
import { composeSpritesheet } from "../lib/spritesheet";
import { routeAnimation, routeStep, type WorkflowStep } from "../router";
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
  toggleFrame,
  useStudioProjections,
} from "./state";

const ACCEPTED_IMAGES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

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

function validateImages(files: File[], maximum: number): string | null {
  if (files.length > maximum) return `Choose ${maximum} or fewer images.`;
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) return `'${file.name}' exceeds 10 MB.`;
    if (file.type && !ACCEPTED_IMAGES.has(file.type)) {
      return `'${file.name}' must be PNG, JPEG, or WebP.`;
    }
  }
  return null;
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
  let selectionTimer: number | null = null;
  let toastTimer: number | null = null;

  const context = reactive({
    state,
    imageModels: [],
    videoModels: [],
    projects: [],
    activeStep: "reference" as WorkflowStep,
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
      const view = await saveProjectDraftFor(
        projectId,
        revision,
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
    setActiveProject(hydrated.id, hydrated.revision);
    reconcileProject(state, hydrated, { preserveDraft });
    if (!preserveDraft) sync.attach(hydrated.id, hydrated.revision, state.draft);
    suppressDraftSave = false;
  }

  async function refreshProjects() {
    context.projects = await dependencies.server.listProjects();
  }

  async function setRoute(step: WorkflowStep, animation?: string | null) {
    if (!state.project) return;
    context.activeStep = step;
    await router.push({
      name: "project",
      params: { projectId: state.project.id },
      query: { step, ...(animation ? { animation } : {}) },
    });
  }

  function inferredStep(view: ProjectView): WorkflowStep {
    if (view.frames.length) return "animations";
    if (view.sourceVideoUrl) return "frames";
    if (view.spriteUrl) return "movement";
    return "reference";
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
      finishOperation(state, name, id, project.id, "error", message(error, "Operation failed"));
    }
  }

  function currentFrames(): string[] {
    return state.animationDraft.frozenFrameUrls ??
      state.animationDraft.frameSequence.flatMap((index) =>
        state.project?.frames[index] ? [state.project.frames[index]] : []);
  }

  function persistSelection(project: ProjectView, indices: number[]) {
    return saveSelectionFor(project.id, project.revision, indices).then((view) => {
      if (state.project?.id !== project.id) return;
      state.project.revision = view.revision;
      sync.advanceRevision(project.id, view.revision);
    });
  }

  context.actions = {
    async setStep(step) {
      await setRoute(step, state.animationDraft.activeAnimationId);
    },
    async generateReference() {
      const prompt = state.draft.spritePrompt.trim();
      if (!prompt) {
        state.operations.reference = { ...state.operations.reference, phase: "error", message: "Enter a sprite prompt first." };
        return;
      }
      if (
        state.project?.animations.length &&
        !await dependencies.confirmation.confirm("Replace the Reference Sprite? All saved Animations will be removed.")
      ) return;
      await run("reference", "Generating Reference Sprite…", async () => {
        const result = await dependencies.server.generateSprite(
          prompt,
          state.draft.spriteModel,
          {
            frameSize: state.draft.frameSize,
            subjectFillPct: state.draft.subjectFillPct,
            colorCount: state.draft.colorCount,
          },
          state.draft.spritePaletteLock,
        );
        return { ...result.view, spriteUrl: result.dataUrl };
      }, "Reference Sprite ready.");
      if (state.operations.reference.phase === "success") await setRoute("movement");
    },
    async uploadReference(files) {
      const file = files[0];
      const invalid = validateImages(files.slice(0, 1), 1);
      if (!file || invalid) {
        state.operations.reference = { ...state.operations.reference, phase: "error", message: invalid ?? "Choose an image." };
        return;
      }
      const project = state.project;
      if (!project) return;
      const id = beginOperation(state, "reference", project.id, "Preparing Reference Sprite…");
      try {
        const prepared = await dependencies.server.prepareSpriteUpload(file, {
          frameSize: state.draft.frameSize,
          subjectFillPct: state.draft.subjectFillPct,
          colorCount: state.draft.colorCount,
        });
        if (
          prepared.requiresConfirmation &&
          !await dependencies.confirmation.confirm("Replace the Reference Sprite and remove its Downstream Artifacts?")
        ) {
          await dependencies.server.discardSpriteUpload();
          finishOperation(state, "reference", id, project.id, "success", "Upload cancelled.");
          return;
        }
        const view = await dependencies.server.commitSpriteUpload(prepared.uploadId);
        if (finishOperation(state, "reference", id, project.id, "success", "Reference Sprite uploaded.")) {
          apply(view);
          notify("Reference Sprite uploaded");
          await setRoute("movement");
        }
      } catch (error) {
        finishOperation(state, "reference", id, project.id, "error", message(error, "Upload failed"));
      }
    },
    async addStyleGuides(files) {
      const available = Math.max(0, 3 - (state.project?.styleGuides.length ?? 0));
      const invalid = validateImages(files, available);
      if (invalid) {
        state.operations.styleGuide = { ...state.operations.styleGuide, phase: "error", message: invalid };
        return;
      }
      await run("styleGuide", "Adding Style Guide Images…", async (project) => {
        let view = project;
        for (const file of files) view = await dependencies.server.uploadStyleGuide(file);
        return view;
      }, "Style Guide Images updated.", { preserveDraft: true });
    },
    async removeStyleGuide(id) {
      await run("styleGuide", "Removing Style Guide Image…",
        () => dependencies.server.removeStyleGuide(id), "Style Guide Image removed.",
        { preserveDraft: true });
    },
    async generateVideo() {
      if (!state.project?.spriteUrl || !state.draft.motionPrompt.trim()) {
        state.operations.video = { ...state.operations.video, phase: "error", message: "A Reference Sprite and movement prompt are required." };
        return;
      }
      if (
        state.project.frames.length &&
        !await dependencies.confirmation.confirm("Generate a new video and replace the current Movement Frames?")
      ) return;
      await run("video", "Generating movement video…",
        () => dependencies.server.generateMotionVideo(state.draft.motionPrompt, state.draft.motionModel),
        "Movement video ready.");
      if (state.operations.video.phase === "success") await setRoute("frames");
    },
    async generateFrames() {
      if (!state.project?.sourceVideoUrl) {
        state.operations.frames = { ...state.operations.frames, phase: "error", message: "Generate a video first." };
        return;
      }
      await run("frames", "Generating Movement Frames…",
        () => dependencies.server.generateMovementFrames(state.draft.paletteLock, state.draft.hardAlphaEdges),
        "Movement Frames ready.");
      if (state.operations.frames.phase === "success") {
        state.animationDraft.frameSequence = state.project?.frames.map((_, index) => index) ?? [];
        await setRoute("animations");
      }
    },
    toggleFrame(index) {
      toggleFrame(state, index);
      const project = state.project;
      if (!project) return;
      if (selectionTimer !== null) dependencies.clock.clearTimeout(selectionTimer);
      selectionTimer = dependencies.clock.setTimeout(() => {
        void persistSelection(project, [...state.animationDraft.frameSequence]);
      }, 700);
    },
    selectAll() {
      state.animationDraft.frozenFrameUrls = null;
      state.animationDraft.frameSequence = state.project?.frames.map((_, index) => index) ?? [];
      if (state.project) void persistSelection(
        state.project,
        [...state.animationDraft.frameSequence],
      );
    },
    selectNone() {
      state.animationDraft.frozenFrameUrls = null;
      state.animationDraft.frameSequence = [];
      if (state.project) void persistSelection(state.project, []);
    },
    async activateAnimation(id) {
      const animation = state.project?.animations.find((candidate) => candidate.id === id);
      if (animation) editAnimation(state, animation);
      else newAnimationDraft(state);
      await setRoute("animations", animation?.id);
    },
    async saveAnimation(update) {
      const frames = currentFrames();
      const name = state.draft.animationName.trim();
      if (!name || frames.length === 0 || !state.project?.targetFrameSize) {
        state.operations.animation = { ...state.operations.animation, phase: "error", message: "Choose frames and enter an Animation name." };
        return;
      }
      const sheet = await composeSpritesheet({
        frameSrcs: frames,
        cellSize: state.project.targetFrameSize.w,
      });
      const input = {
        name,
        frameIndices: [...state.animationDraft.frameSequence],
        fps: state.draft.animationFps,
        dataUrl: sheet.dataUrl,
        sourceAnimationId: state.animationDraft.activeAnimationId ?? undefined,
      };
      await run("animation", update ? "Updating Animation…" : "Saving Animation…",
        () => update && state.animationDraft.activeAnimationId
          ? dependencies.server.updateAnimation(state.animationDraft.activeAnimationId, input)
          : dependencies.server.createAnimation(input),
        update ? "Animation updated." : "Animation saved.");
      const saved = state.project?.animations.find((animation) => animation.name === name);
      if (saved) await context.actions.activateAnimation(saved.id);
    },
    async deleteAnimation(id) {
      if (!await dependencies.confirmation.confirm("Delete this Animation?")) return;
      await run("animation", "Deleting Animation…",
        () => dependencies.server.deleteAnimation(id), "Animation deleted.");
      if (state.animationDraft.activeAnimationId === id) newAnimationDraft(state);
    },
    exportAnimation(id) {
      const animation = state.project?.animations.find((candidate) => candidate.id === id);
      if (!animation) return;
      const link = document.createElement("a");
      link.href = animation.spritesheetUrl;
      link.download = `${animation.name}.png`;
      link.click();
    },
    async createProject() {
      await sync.flush();
      const view = await dependencies.server.createProject();
      await openProject(view);
    },
    async switchProject(id) {
      if (id === state.project?.id) return;
      await sync.flush();
      await openProject(await dependencies.server.getProject(id));
    },
    async renameProject(id) {
      const project = context.projects.find((candidate) => candidate.id === id);
      const label = await dependencies.confirmation.prompt("Project label", project?.label ?? "");
      if (!label?.trim()) return;
      const view = await dependencies.server.renameProject(id, label.trim());
      if (id === state.project?.id) apply(view);
      await refreshProjects();
    },
    async deleteProject(id) {
      if (!await dependencies.confirmation.confirm("Delete this Project?")) return;
      await dependencies.server.deleteProject(id);
      await refreshProjects();
      if (id !== state.project?.id) return;
      const view = context.projects[0]
        ? await dependencies.server.getProject(context.projects[0].id)
        : await dependencies.server.createProject();
      await openProject(view);
    },
    async retrySave() {
      await sync.flush();
    },
  };

  async function openProject(view: ProjectView) {
    apply(view);
    context.activeStep = inferredStep(view);
    await router.push({
      name: "project",
      params: { projectId: view.id },
      query: { step: context.activeStep },
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
    () => [route.query.step, route.query.animation],
    () => {
      context.activeStep = routeStep(route);
      const id = routeAnimation(route);
      const animation = state.project?.animations.find((candidate) => candidate.id === id);
      if (animation && state.animationDraft.activeAnimationId !== id) editAnimation(state, animation);
      if (id && !animation) {
        newAnimationDraft(state);
        void router.replace({
          name: "project",
          params: { projectId: state.project?.id },
          query: { step: "animations" },
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
    const requestedStep = Array.isArray(route.query.step) ? route.query.step[0] : route.query.step;
    context.activeStep = typeof requestedStep === "string" &&
      ["reference", "movement", "frames", "animations"].includes(requestedStep)
      ? routeStep(route)
      : inferredStep(view);
    const animationId = routeAnimation(route);
    const animation = view.animations.find(({ id }) => id === animationId);
    if (animation) editAnimation(state, animation);
    await router.replace({
      name: "project",
      params: { projectId: view.id },
      query: {
        step: context.activeStep,
        ...(animation ? { animation: animation.id } : {}),
      },
    });
    context.ready = true;
  }).catch((error) => {
    context.bootError = message(error, "Backend not reachable.");
  });

  return context;
}
