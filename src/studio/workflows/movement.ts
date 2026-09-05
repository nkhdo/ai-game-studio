import { toggleFrame } from "../state";
import { requestContext, type WorkflowEnvironment } from "./types";

export function createMovementActions(env: WorkflowEnvironment) {
  const { state, dependencies, run } = env;

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
    },

    selectAll() {
      state.animationDraft.frozenFrameUrls = null;
      state.animationDraft.frameSequence = state.project?.frames.map((_, index) => index) ?? [];
    },

    selectNone() {
      state.animationDraft.frozenFrameUrls = null;
      state.animationDraft.frameSequence = [];
    },
  };
}
