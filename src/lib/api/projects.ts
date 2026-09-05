import { getJson, postJson } from "./transport";
import type { ProjectMutation, ProjectRequestContext, ProjectSummary, ProjectView } from "./types";

export function getProject(id: string): Promise<ProjectView> {
  return getJson(`/api/projects/${encodeURIComponent(id)}`);
}

export function listProjects(): Promise<ProjectSummary[]> {
  return getJson("/api/projects");
}

export function createProject(): Promise<ProjectView> {
  return postJson("/api/projects", { label: "Untitled project" });
}

export function renameProject(id: string, label: string): Promise<ProjectMutation<Pick<ProjectView, "label">>> {
  return postJson("/api/projects/rename", { id, label });
}

export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return postJson("/api/projects/delete", { id });
}

export function saveProjectDraft(
  context: ProjectRequestContext,
  patch: Record<string, unknown>,
  base: Record<string, unknown>,
): Promise<ProjectMutation> {
  return postJson(
    "/api/projects/draft",
    { revision: context.revision, patch, base },
    context,
  );
}
