export interface ProjectView {
  id: string;
  label: string;
  createdAt: string;
  revision: number;
  spriteAcquisitionMode: "generate" | "upload";
  draftFrameSize: number;
  draftSubjectFillPct: number;
  draftColorCount: number | null;
  animationDraftName: string;
  animationDraftFps: number;
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
  animations: AnimationView[];
  updatedAt: string;
}

export interface AnimationView {
  id: string;
  name: string;
  frameIndices: number[];
  frameUrls: string[];
  fps: number;
  spritesheetUrl: string;
  previewGifUrl: string | null;
  createdAt: string;
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
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRequestContext {
  id: string;
  revision: number;
}

function projectHeaders(context: ProjectRequestContext): Record<string, string> {
  return {
    "X-Project-ID": context.id,
    "X-Project-Revision": String(context.revision),
  };
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

async function postJson<T>(
  path: string,
  body: unknown,
  context?: ProjectRequestContext,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(context ? projectHeaders(context) : {}),
    },
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
  context: ProjectRequestContext,
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
  }, context);
}

export async function uploadStyleGuide(
  context: ProjectRequestContext,
  file: File,
): Promise<ProjectView> {
  const body = new FormData();
  body.append("image", file);
  const res = await fetch("/api/sprites/style-guides", {
    method: "POST",
    headers: projectHeaders(context),
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : `Style guide upload failed (${res.status})`,
    );
  }
  return json as unknown as ProjectView;
}

export function removeStyleGuide(context: ProjectRequestContext, id: string): Promise<ProjectView> {
  return postJson("/api/sprites/style-guides/remove", { id }, context);
}

export async function prepareSpriteUpload(
  context: ProjectRequestContext,
  file: File,
  geometry: AcquisitionGeometry,
): Promise<PreparedSpriteUpload> {
  const body = new FormData();
  body.append("image", file);
  body.append("frameSize", String(geometry.frameSize));
  body.append("subjectFillPct", String(geometry.subjectFillPct));
  if (geometry.colorCount !== null) body.append("colorCount", String(geometry.colorCount));
  const res = await fetch("/api/sprites/upload/prepare", {
    method: "POST",
    headers: projectHeaders(context),
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Upload failed (${res.status})`);
  }
  return json as unknown as PreparedSpriteUpload;
}

export function commitSpriteUpload(
  context: ProjectRequestContext,
  uploadId: string,
): Promise<ProjectView> {
  return postJson("/api/sprites/upload/commit", { uploadId }, context);
}

export function discardSpriteUpload(context: ProjectRequestContext): Promise<{ ok: boolean }> {
  return postJson("/api/sprites/upload/discard", {}, context);
}

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

export function getImageModels(): Promise<ImageModelsResponse> {
  return getJson("/api/models/image");
}

export function getProject(id: string): Promise<ProjectView> {
  return getJson(`/api/projects/${encodeURIComponent(id)}`);
}

export function listProjects(): Promise<ProjectSummary[]> {
  return getJson("/api/projects");
}

export function createProject(): Promise<ProjectView> {
  return postJson("/api/projects", { label: "Untitled project" });
}

export function renameProject(id: string, label: string): Promise<ProjectView> {
  return postJson("/api/projects/rename", { id, label });
}

export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return postJson("/api/projects/delete", { id });
}

export function saveProjectDraft(
  context: ProjectRequestContext,
  patch: Record<string, unknown>,
  base: Record<string, unknown>,
): Promise<ProjectView> {
  return postJson(
    "/api/projects/draft",
    { revision: context.revision, patch, base },
    context,
  );
}

export function saveSelection(
  context: ProjectRequestContext,
  selectedIndices: number[],
): Promise<ProjectView> {
  return postJson("/api/projects/selection", { selectedIndices }, context);
}

export function saveSpritesheet(
  context: ProjectRequestContext,
  dataUrl: string,
): Promise<ProjectView> {
  return postJson("/api/projects/spritesheet", { dataUrl }, context);
}

export interface AnimationSaveInput {
  name: string;
  frameIndices: number[];
  fps: number;
  dataUrl: string;
  sourceAnimationId?: string;
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

export async function checkHealth(): Promise<{ ok: boolean; hasApiKey: boolean }> {
  const res = await fetch("/api/health");
  return res.json();
}
