import type { ProjectMutation, ProjectRequestContext, ProjectView } from "../../lib/api";
import type { StudioActions, StudioContext, ToastKind } from "../context";
import type { StudioDependencies } from "../dependencies";
import type { DraftSynchronizer } from "../draft-sync";
import type { Operation, StudioState } from "../state";

export type RunProjectOperation = (
  name: Operation,
  progress: string,
  task: (project: ProjectView) => Promise<ProjectMutation>,
  success: string,
  options?: { preserveDraft?: boolean; toastError?: boolean },
) => Promise<void>;

export interface WorkflowEnvironment {
  state: StudioState;
  context: StudioContext;
  dependencies: StudioDependencies;
  sync: DraftSynchronizer;
  run: RunProjectOperation;
  apply(view: ProjectView, preserveDraft?: boolean): void;
  applyMutation(project: ProjectView, mutation: ProjectMutation, preserveDraft?: boolean): void;
  notify(message: string, kind?: ToastKind): void;
  refreshProjects(): Promise<void>;
  openProject(view: ProjectView): Promise<void>;
  setPanel(panel: Parameters<StudioActions["setPanel"]>[0], animation?: string | null): Promise<void>;
}

export function requestContext(project: ProjectView): ProjectRequestContext {
  return { id: project.id, revision: project.revision };
}

export function mergeMutation(project: ProjectView, mutation: ProjectMutation): ProjectView {
  return {
    ...project,
    ...mutation.changes,
    revision: mutation.revision,
    updatedAt: mutation.updatedAt,
  };
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
