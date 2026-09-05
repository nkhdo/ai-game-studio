import { toggleFrame } from "../state";
import { requestContext, type WorkflowEnvironment } from "./types";

export function createMovementActions(env: WorkflowEnvironment) {
  const { state, dependencies, run, sync } = env;
  let selectionTimer: number | null = null;

  function persistSelection(indices: number[]) {
    const project = state.project;
    if (!project) return Promise.resolve();
    return dependencies.server.saveSelection(requestContext(project), indices).then((view) => {
      if (state.project?.id !== project.id) return;
      state.project.revision = view.revision;
      sync.advanceRevision(project.id, view.revision);
    });
  }

  return {
    async generateVideo() {
      if (!state.project?.spriteUrl || !state.draft.motionPrompt.trim()) {
        state.operations.video = { ...state.operations.video, phase: "error" as const, message: "A Reference Sprite and movement prompt are required." };
        return;
      }
      if (state.project.frames.length &&
        !await dependencies.confirmation.confirm("Generate a new video and replace the current Movement Frames?")) return;
      await run("video", "Generating movement video…",
        (project) => dependencies.server.generateMotionVideo(
          requestContext(project), state.draft.motionPrompt, state.draft.motionModel),
        "Movement video ready.");
    },

    async generateFrames() {
      if (!state.project?.sourceVideoUrl) {
        state.operations.frames = { ...state.operations.frames, phase: "error" as const, message: "Generate a video first." };
        return;
      }
      await run("frames", "Generating Movement Frames…",
        (project) => dependencies.server.generateMovementFrames(
          requestContext(project), state.draft.paletteLock, state.draft.hardAlphaEdges),
        "Movement Frames ready.");
      if (state.operations.frames.phase === "success") {
        state.animationDraft.frameSequence = state.project?.frames.map((_, index) => index) ?? [];
      }
    },

    toggleFrame(index: number) {
      toggleFrame(state, index);
      if (selectionTimer !== null) dependencies.clock.clearTimeout(selectionTimer);
      selectionTimer = dependencies.clock.setTimeout(() => {
        void persistSelection([...state.animationDraft.frameSequence]);
      }, 700);
    },

    selectAll() {
      state.animationDraft.frozenFrameUrls = null;
      state.animationDraft.frameSequence = state.project?.frames.map((_, index) => index) ?? [];
      void persistSelection([...state.animationDraft.frameSequence]);
    },

    selectNone() {
      state.animationDraft.frozenFrameUrls = null;
      state.animationDraft.frameSequence = [];
      void persistSelection([]);
    },
  };
}
