import { composeSpritesheet } from "../../lib/spritesheet";
import { editAnimation, newAnimationDraft } from "../state";
import { requestContext, type WorkflowEnvironment } from "./types";

export function createAnimationActions(env: WorkflowEnvironment) {
  const { state, context, dependencies, run } = env;

  function currentFrames(): string[] {
    return state.animationDraft.frozenFrameUrls ??
      state.animationDraft.frameSequence.flatMap((index) =>
        state.project?.frames[index] ? [state.project.frames[index]] : []);
  }

  return {
    async activateAnimation(id: string | null) {
      const animation = state.project?.animations.find((candidate) => candidate.id === id);
      if (animation) editAnimation(state, animation);
      else newAnimationDraft(state);
      await env.setPanel(context.activePanel, animation?.id);
    },

    async saveAnimation(update: boolean) {
      const frames = currentFrames();
      const name = state.draft.animationName.trim();
      if (!name || frames.length === 0 || !state.project?.targetFrameSize) {
        state.operations.animation = { ...state.operations.animation, phase: "error" as const, message: "Choose frames and enter an Animation name." };
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
      };
      await run("animation", update ? "Updating Animation…" : "Saving Animation…",
        (project) => update && state.animationDraft.activeAnimationId
          ? dependencies.server.updateAnimation(
            requestContext(project), state.animationDraft.activeAnimationId, input)
          : dependencies.server.createAnimation(requestContext(project), input),
        update ? "Animation updated." : "Animation saved.");
      const saved = state.project?.animations.find((animation) => animation.name === name);
      if (saved) await env.setPanel(context.activePanel, saved.id);
      if (saved) editAnimation(state, saved);
    },

    async deleteAnimation(id: string) {
      if (!await dependencies.confirmation.confirm("Delete this Animation?")) return;
      await run("animation", "Deleting Animation…",
        (project) => dependencies.server.deleteAnimation(requestContext(project), id),
        "Animation deleted.");
      if (state.animationDraft.activeAnimationId === id) newAnimationDraft(state);
    },

    exportAnimation(id: string) {
      const animation = state.project?.animations.find((candidate) => candidate.id === id);
      if (!animation) return;
      const link = document.createElement("a");
      link.href = animation.spritesheetUrl;
      link.download = `${animation.name}.png`;
      link.click();
    },
  };
}
