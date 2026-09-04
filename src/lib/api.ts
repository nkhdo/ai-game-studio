export interface ProjectView {
  name: string;
  spritePrompt: string;
  spriteModel: string;
  styleGuides: StyleGuideImageView[];
  styleGuidesChanged: boolean;
  spritePaletteLock: boolean;
  spriteAcquisition: "generated" | "uploaded" | null;
  spriteOriginalFilename: string | null;
  backgroundSuitability: "suitable" | "warning" | "unknown";
  motionPrompt: string;
  motionModel: string;
  paletteLock: boolean;
  hardAlphaEdges: boolean;
  preservedOffPalettePixels: number | null;
  removedLowAlphaPixels: number | null;
  removedChromaFringePixels: number | null;
  spriteUrl: string | null;
  spriteDimensions: { w: number; h: number } | null;
  targetFrameSize: { w: number; h: number } | null;
  subjectFillPct: number | null;
  colorCount: number | null;
  subjectFillMeasured: number | null;
  frames: string[];
  selectedFrameIndices: number[];
  sourceVideoUrl: string | null;
  spritesheetUrl: string | null;
  previewGifUrl: string | null;
  updatedAt: string;
}

export interface StyleGuideImageView {
  id: string;
  originalFilename: string;
  url: string;
}

export interface VideoModelOption {
  id: string;
  label: string;
  defaultDuration: number;
  inputMode: "first-frame" | "reference";
  minInputWidth: number | null;
  minInputHeight: number | null;
  inputResizeKernel: "nearest";
  constraintNote: string | null;
}

export interface ImageModelOption {
  id: string;
  label: string;
  maxStyleGuideImages: number;
  sizeStrategy: "target-size" | "prompt-only";
}

export interface AcquisitionGeometry {
  frameSize: number;
  subjectFillPct: number;
  colorCount: number | null;
}

export interface ImageModelsResponse {
  models: readonly ImageModelOption[];
  default: string;
}

export interface VideoModelsResponse {
  models: readonly VideoModelOption[];
  default: string;
}

export interface ProjectSummary {
  name: string;
  updatedAt: string;
}

export interface GenerateSpriteResponse {
  view: ProjectView;
  dataUrl: string;
}

export interface PreparedSpriteUpload {
  uploadId: string;
  originalFilename: string;
  dimensions: { w: number; h: number };
  backgroundSuitability: "suitable" | "warning" | "unknown";
  preparedAt: string;
  requiresConfirmation: boolean;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

export function generateSprite(
  prompt: string,
  model?: string,
  geometry?: AcquisitionGeometry,
  spritePaletteLock?: boolean,
): Promise<GenerateSpriteResponse> {
  return postJson("/api/sprites/generate", {
    prompt,
    model,
    frameSize: geometry?.frameSize,
    subjectFillPct: geometry?.subjectFillPct,
    colorCount: geometry?.colorCount ?? null,
    spritePaletteLock: spritePaletteLock === true,
  });
}

export async function uploadStyleGuide(file: File): Promise<ProjectView> {
  const body = new FormData();
  body.append("image", file);
  const res = await fetch("/api/sprites/style-guides", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : `Style guide upload failed (${res.status})`,
    );
  }
  return json as unknown as ProjectView;
}

export function removeStyleGuide(id: string): Promise<ProjectView> {
  return postJson("/api/sprites/style-guides/remove", { id });
}

export async function prepareSpriteUpload(
  file: File,
  geometry: AcquisitionGeometry,
): Promise<PreparedSpriteUpload> {
  const body = new FormData();
  body.append("image", file);
  body.append("frameSize", String(geometry.frameSize));
  body.append("subjectFillPct", String(geometry.subjectFillPct));
  if (geometry.colorCount !== null) body.append("colorCount", String(geometry.colorCount));
  const res = await fetch("/api/sprites/upload/prepare", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Upload failed (${res.status})`);
  }
  return json as unknown as PreparedSpriteUpload;
}

export function commitSpriteUpload(uploadId: string): Promise<ProjectView> {
  return postJson("/api/sprites/upload/commit", { uploadId });
}

export function discardSpriteUpload(): Promise<{ ok: boolean }> {
  return postJson("/api/sprites/upload/discard", {});
}

export function animateSprite(
  text: string,
  model?: string,
  paletteLock?: boolean,
  hardAlphaEdges?: boolean,
): Promise<ProjectView> {
  return postJson("/api/sprites/animate", { text, model, paletteLock, hardAlphaEdges });
}

export function reextractFrames(
  paletteLock: boolean,
  hardAlphaEdges: boolean,
): Promise<ProjectView> {
  return postJson("/api/sprites/reextract", { paletteLock, hardAlphaEdges });
}

export function getVideoModels(): Promise<VideoModelsResponse> {
  return getJson("/api/models/video");
}

export function getImageModels(): Promise<ImageModelsResponse> {
  return getJson("/api/models/image");
}

export function getCurrentProject(): Promise<ProjectView> {
  return getJson("/api/projects/current");
}

export function listProjects(): Promise<ProjectSummary[]> {
  return getJson("/api/projects");
}

export function saveProject(name: string): Promise<ProjectView> {
  return postJson("/api/projects/save", { name });
}

export function loadProject(name: string): Promise<ProjectView> {
  return postJson("/api/projects/load", { name });
}

export function deleteProject(name: string): Promise<{ ok: boolean }> {
  return postJson("/api/projects/delete", { name });
}

export function newProject(): Promise<ProjectView> {
  return postJson("/api/projects/new", {});
}

export function saveSelection(selectedIndices: number[]): Promise<ProjectView> {
  return postJson("/api/projects/selection", { selectedIndices });
}

export function saveSpritesheet(dataUrl: string): Promise<ProjectView> {
  return postJson("/api/projects/spritesheet", { dataUrl });
}

export async function checkHealth(): Promise<{ ok: boolean; hasApiKey: boolean }> {
  const res = await fetch("/api/health");
  return res.json();
}
