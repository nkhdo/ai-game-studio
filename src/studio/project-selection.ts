import type { ProjectSummary } from "../lib/api";

export function mostRecentlyUpdatedProject(
  projects: readonly ProjectSummary[],
): ProjectSummary | undefined {
  return projects.reduce<ProjectSummary | undefined>((latest, project) =>
    !latest || project.updatedAt > latest.updatedAt ? project : latest, undefined);
}
