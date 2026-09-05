import { getJson, postJson } from "./transport";
import type { ProjectRequestContext, ProjectView, VideoModelsResponse } from "./types";

export function generateMotionVideo(
  context: ProjectRequestContext,
  text: string,
  model?: string,
): Promise<ProjectView> {
  return postJson("/api/sprites/video", { text, model }, context);
}

export function generateMovementFrames(
  context: ProjectRequestContext,
  paletteLock: boolean,
  hardAlphaEdges: boolean,
): Promise<ProjectView> {
  return postJson("/api/sprites/frames", { paletteLock, hardAlphaEdges }, context);
}

export function getVideoModels(): Promise<VideoModelsResponse> {
  return getJson("/api/models/video");
}
