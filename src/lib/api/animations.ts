import { postJson } from "./transport";
import type { ProjectRequestContext, ProjectView } from "./types";

export interface AnimationSaveInput {
  name: string;
  frameIndices: number[];
  fps: number;
  dataUrl: string;
}

export function createAnimation(
  context: ProjectRequestContext,
  input: AnimationSaveInput,
): Promise<ProjectView> {
  return postJson("/api/projects/animations", input, context);
}

export function updateAnimation(
  context: ProjectRequestContext,
  id: string,
  input: AnimationSaveInput,
): Promise<ProjectView> {
  return postJson("/api/projects/animations/update", { id, ...input }, context);
}

export function deleteAnimation(context: ProjectRequestContext, id: string): Promise<ProjectView> {
  return postJson("/api/projects/animations/delete", { id }, context);
}
