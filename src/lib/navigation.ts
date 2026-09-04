export const STEP_NAMES = ["reference", "motion", "frames"] as const;

export type WorkflowStep = (typeof STEP_NAMES)[number];

export interface NavigationState {
  project: string | null;
  step: WorkflowStep | null;
  animation: string | null;
}

export function parseNavigation(url: URL): NavigationState {
  const project = url.searchParams.get("project");
  const rawStep = url.searchParams.get("step");
  const step = STEP_NAMES.find((candidate) => candidate === rawStep) ?? null;
  const animation = url.searchParams.get("animation");
  return { project: project || null, step, animation: animation || null };
}

export function stepNumber(step: WorkflowStep): number {
  return STEP_NAMES.indexOf(step) + 1;
}

export function stepName(step: number): WorkflowStep {
  return STEP_NAMES[Math.max(0, Math.min(STEP_NAMES.length - 1, step - 1))];
}

export function withNavigation(
  current: URL,
  navigation: { project?: string | null; step?: WorkflowStep; animation?: string | null },
): URL {
  const next = new URL(current);
  if (navigation.project !== undefined) {
    if (navigation.project) next.searchParams.set("project", navigation.project);
    else next.searchParams.delete("project");
  }
  if (navigation.step !== undefined) next.searchParams.set("step", navigation.step);
  if (navigation.animation !== undefined) {
    if (navigation.animation) next.searchParams.set("animation", navigation.animation);
    else next.searchParams.delete("animation");
  }
  return next;
}
