import { inject, type InjectionKey } from "vue";
import type { ImageModelOption, ProjectSummary, VideoModelOption } from "../lib/api";
import type { StudioState } from "./state";

export interface StudioActions {
  setPanel(panel: "reference" | "movement" | "frames"): Promise<void>;
  generateReference(): Promise<void>;
  uploadReference(files: File[]): Promise<void>;
  addStyleGuides(files: File[]): Promise<void>;
  removeStyleGuide(id: string): Promise<void>;
  regenerateTransparentReferencePreview(): Promise<void>;
  generateVideo(): Promise<void>;
  generateFrames(): Promise<void>;
  toggleFrame(index: number): void;
  selectAll(): void;
  selectNone(): void;
  activateAnimation(id: string | null): Promise<void>;
  saveAnimation(update: boolean): Promise<void>;
  deleteAnimation(id: string): Promise<void>;
  exportAnimation(id: string): void;
  createProject(): Promise<void>;
  switchProject(id: string): Promise<void>;
  renameProject(id: string): Promise<void>;
  deleteProject(id: string): Promise<void>;
  retrySave(): Promise<void>;
}

export interface StudioContext {
  state: StudioState;
  imageModels: ImageModelOption[];
  videoModels: VideoModelOption[];
  projects: ProjectSummary[];
  activePanel: "reference" | "movement" | "frames";
  hasApiKey: boolean;
  frameUrls: string[];
  actions: StudioActions;
}

export type ToastKind = "normal" | "success" | "error";

export const studioKey: InjectionKey<StudioContext> = Symbol("studio");

export function useStudio(): StudioContext {
  const value = inject(studioKey);
  if (!value) throw new Error("Studio context is not available");
  return value;
}
