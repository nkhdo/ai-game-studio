import type {
  ImageModelOption,
  ProjectSummary,
  ProjectView,
  StyleGuideImageView,
  VideoModelOption,
} from "./api";

export const DEFAULT_IMAGE_MODEL = "openai/gpt-image-2";
export const DEFAULT_VIDEO_MODEL = "x-ai/grok-imagine-video";
export const DEFAULT_TARGET_FRAME_SIZE = 128;
export const DEFAULT_SUBJECT_FILL_PCT = 70;
export const DEFAULT_COLOR_COUNT: number | null = 16;

export type AppStatus =
  | "idle"
  | "generating-image"
  | "uploading-style-guide"
  | "uploading-image"
  | "generating-video"
  | "extracting-frames"
  | "done"
  | "error";

export interface AppState {
  status: AppStatus;
  errorMessage: string | null;
  spritePrompt: string;
  spriteModel: string;
  styleGuides: StyleGuideImageView[];
  styleGuidesChanged: boolean;
  styleMatchReference: boolean;
  spriteAcquisitionMode: "generate" | "upload";
  spriteAcquisition: "generated" | "uploaded" | null;
  spriteOriginalFilename: string | null;
  backgroundSuitability: "suitable" | "warning" | "unknown";
  hasApiKey: boolean;
  imageModels: ImageModelOption[];
  motionPrompt: string;
  motionModel: string;
  videoModels: VideoModelOption[];
  spriteSrc: string | null;
  spriteDimensions: { w: number; h: number } | null;
  frameSize: number;
  appliedFrameSize: number | null;
  subjectFillPct: number;
  colorCount: number | null;
  subjectFillMeasured: number | null;
  frames: string[];
  motionVideoSrc: string | null;
  selectedFrameIndices: Set<number>;
  spritesheetSrc: string | null;
  spritesheetCols: number | null;
  previewGifSrc: string | null;
  previewGifBuilding: boolean;
  currentProjectName: string;
  savedProjects: ProjectSummary[];
}

export function createInitialState(): AppState {
  return {
    status: "idle",
    errorMessage: null,
    spritePrompt: "",
    spriteModel: DEFAULT_IMAGE_MODEL,
    styleGuides: [],
    styleGuidesChanged: false,
    styleMatchReference: false,
    spriteAcquisitionMode: "generate",
    spriteAcquisition: null,
    spriteOriginalFilename: null,
    backgroundSuitability: "unknown",
    hasApiKey: false,
    imageModels: [],
    motionPrompt: "",
    motionModel: DEFAULT_VIDEO_MODEL,
    videoModels: [],
    spriteSrc: null,
    spriteDimensions: null,
    frameSize: DEFAULT_TARGET_FRAME_SIZE,
    appliedFrameSize: null,
    subjectFillPct: DEFAULT_SUBJECT_FILL_PCT,
    colorCount: DEFAULT_COLOR_COUNT,
    subjectFillMeasured: null,
    frames: [],
    motionVideoSrc: null,
    selectedFrameIndices: new Set(),
    spritesheetSrc: null,
    spritesheetCols: null,
    previewGifSrc: null,
    previewGifBuilding: false,
    currentProjectName: "latest",
    savedProjects: [],
  };
}

export function cacheBust(url: string | null, key: string): string | null {
  if (!url) return null;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(key)}`;
}

export function hydrateFromView(view: ProjectView): Partial<AppState> {
  const v = view.updatedAt;
  return {
    spritePrompt: view.spritePrompt,
    spriteModel: view.spriteModel || DEFAULT_IMAGE_MODEL,
    styleGuides: view.styleGuides.map((guide) => ({
      ...guide,
      url: cacheBust(guide.url, v)!,
    })),
    styleGuidesChanged: view.styleGuidesChanged,
    styleMatchReference: view.styleMatchReference ?? false,
    spriteAcquisitionMode: view.spriteAcquisition === "uploaded" ? "upload" : "generate",
    spriteAcquisition: view.spriteAcquisition,
    spriteOriginalFilename: view.spriteOriginalFilename,
    backgroundSuitability: view.backgroundSuitability,
    motionPrompt: view.motionPrompt,
    motionModel: view.motionModel || DEFAULT_VIDEO_MODEL,
    spriteSrc: cacheBust(view.spriteUrl, v),
    spriteDimensions: view.spriteDimensions,
    frameSize: view.targetFrameSize?.w ?? DEFAULT_TARGET_FRAME_SIZE,
    appliedFrameSize: view.targetFrameSize?.w ?? null,
    subjectFillPct: view.subjectFillPct ?? DEFAULT_SUBJECT_FILL_PCT,
    colorCount: view.targetFrameSize ? view.colorCount : DEFAULT_COLOR_COUNT,
    subjectFillMeasured: view.subjectFillMeasured ?? null,
    frames: view.frames.map((f) => cacheBust(f, v)!),
    selectedFrameIndices: new Set(view.selectedFrameIndices),
    motionVideoSrc: cacheBust(view.sourceVideoUrl, v),
    spritesheetSrc: cacheBust(view.spritesheetUrl, v),
    spritesheetCols: view.spritesheetUrl ? view.selectedFrameIndices.length : null,
    previewGifSrc: cacheBust(view.previewGifUrl, v),
    previewGifBuilding: false,
    currentProjectName: view.name,
  };
}

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  set(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) fn(this.state);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }
}
