import type { WorkflowEnvironment } from "./types";

export function createProjectActions(env: WorkflowEnvironment) {
  const { state, context, dependencies, sync } = env;
  return {
    async createProject() {
      await sync.flush();
      await env.openProject(await dependencies.server.createProject());
    },

    async switchProject(id: string) {
      if (id === state.project?.id) return;
      await sync.flush();
      await env.openProject(await dependencies.server.getProject(id));
    },

    async renameProject(id: string) {
      const project = context.projects.find((candidate) => candidate.id === id);
      const label = await dependencies.confirmation.prompt("Project label", project?.label ?? "");
      if (!label?.trim()) return;
      const view = await dependencies.server.renameProject(id, label.trim());
      if (id === state.project?.id && state.project) env.applyMutation(state.project, view);
      await env.refreshProjects();
    },

    async deleteProject(id: string) {
      if (!await dependencies.confirmation.confirm("Delete this Project?")) return;
      await dependencies.server.deleteProject(id);
      await env.refreshProjects();
      if (id !== state.project?.id) return;
      const view = context.projects[0]
        ? await dependencies.server.getProject(context.projects[0].id)
        : await dependencies.server.createProject();
      await env.openProject(view);
    },

    async retrySave() {
      await sync.flush();
    },
  };
}
