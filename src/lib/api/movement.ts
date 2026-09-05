import { getJson, postJson } from "./transport";
import type { ProjectMutation, ProjectRequestContext, ProjectView, VideoModelsResponse } from "./types";

export type VideoMutation = ProjectMutation<Pick<ProjectView,
  "motionPrompt" | "motionModel" | "sourceVideoUrl" | "frames" | "framesUpdatedAt" |
  "preservedOffPalettePixels" | "removedLowAlphaPixels" | "removedChromaFringePixels"
>>;
export type FramesMutation = ProjectMutation<Pick<ProjectView,
  "frames" | "framesUpdatedAt" | "paletteLock" | "hardAlphaEdges" |
  "preservedOffPalettePixels" | "removedLowAlphaPixels" | "removedChromaFringePixels"
>>;

export function generateMotionVideo(
  context: ProjectRequestContext,
  text: string,
  model?: string,
): Promise<VideoMutation> {
  return postJson("/api/sprites/video", { text, model }, context);
}

export function generateMovementFrames(
  context: ProjectRequestContext,
  paletteLock: boolean,
  hardAlphaEdges: boolean,
): Promise<FramesMutation> {
  return postJson("/api/sprites/frames", { paletteLock, hardAlphaEdges }, context);
}

export function getVideoModels(): Promise<VideoModelsResponse> {
  return getJson("/api/models/video");
}
