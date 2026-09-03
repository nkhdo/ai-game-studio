import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  LATEST_DIR,
  PROJECTS_DIR,
  PROJECT_FILES,
  ensureInsideRoot,
  projectDir,
  safeProjectName,
} from "./files.js";
import type { BackgroundSuitability, SpriteAcquisition } from "./reference-sprite.js";

export interface StyleGuideImage {
  id: string;
  originalFilename: string;
  path: string;
}

export interface ProjectManifest {
  name: string;
  spritePrompt: string;
  spriteModel: string;
  styleGuideImages: StyleGuideImage[];
  styleGuideSelection: string[];
  appliedStyleGuideSet: string[];
  spritePaletteLock: boolean;
  spriteAcquisition: SpriteAcquisition | null;
  spriteOriginalFilename: string | null;
  backgroundSuitability: BackgroundSuitability;
  motionPrompt: string;
  motionModel: string;
  paletteLock: boolean;
  sprite: string | null;
  spriteDimensions: { w: number; h: number } | null;
  targetFrameSize: { w: number; h: number } | null;
  subjectFillPct: number | null;
  colorCount: number | null;
  subjectFillMeasured: number | null;
  frames: string[];
  selectedFrameIndices: number[];
  spritesheet: string | null;
  previewGif: string | null;
  updatedAt: string;
}

export interface ProjectView {
  name: string;
  spritePrompt: string;
  spriteModel: string;
  styleGuides: Array<{
    id: string;
    originalFilename: string;
    url: string;
  }>;
  styleGuidesChanged: boolean;
  spriteAcquisition: SpriteAcquisition | null;
  spritePaletteLock: boolean;
  backgroundSuitability: BackgroundSuitability;
  motionPrompt: string;
  motionModel: string;
  paletteLock: boolean;
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

export function emptyManifest(name = "latest"): ProjectManifest {
  return {
    name,
    spritePrompt: "",
    spriteModel: "openai/gpt-image-2",
    styleGuideImages: [],
    styleGuideSelection: [],
    appliedStyleGuideSet: [],
    spritePaletteLock: false,
    spriteAcquisition: null,
    spriteOriginalFilename: null,
    backgroundSuitability: "unknown",
    motionPrompt: "",
    motionModel: "x-ai/grok-imagine-video",
    paletteLock: false,
    sprite: null,
    spriteDimensions: null,
    targetFrameSize: null,
    subjectFillPct: null,
    colorCount: null,
    subjectFillMeasured: null,
    frames: [],
    selectedFrameIndices: [],
    spritesheet: null,
    previewGif: null,
    updatedAt: new Date().toISOString(),
  };
}

function manifestPath(name: string): string {
  return path.join(projectDir(name), PROJECT_FILES.manifest);
}

// `dirName` selects the directory on disk. The manifest's `name` field is the
// conceptual project label and is preserved as-stored — for latest/ it can be
// any saved name (or "latest" meaning untitled).
export async function readManifest(dirName: string): Promise<ProjectManifest> {
  const p = manifestPath(dirName);
  if (!existsSync(p)) return emptyManifest(dirName);
  try {
    const raw = await readFile(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectManifest>;
    const hydrated = { ...emptyManifest(dirName), ...parsed };
    if (!hydrated.spriteAcquisition && hydrated.sprite) hydrated.spriteAcquisition = "generated";
    return hydrated;
  } catch {
    return emptyManifest(dirName);
  }
}

export async function writeManifest(
  dirName: string,
  manifest: ProjectManifest,
): Promise<ProjectManifest> {
  await mkdir(projectDir(dirName), { recursive: true });
  const toWrite: ProjectManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(manifestPath(dirName), JSON.stringify(toWrite, null, 2));
  return toWrite;
}

export async function updateLatest(
  patch: Partial<ProjectManifest>,
): Promise<ProjectManifest> {
  const current = await readManifest("latest");
  return writeManifest("latest", { ...current, ...patch });
}


export function toView(m: ProjectManifest): ProjectView {
  // URLs always resolve against the working-state directory.
  // `m.name` is the conceptual project name, not the directory.
  const base = `/projects/latest/`;
  return {
    name: m.name,
    spritePrompt: m.spritePrompt,
    spriteModel: m.spriteModel,
    styleGuides: m.styleGuideSelection.flatMap((id) => {
      const guide = m.styleGuideImages.find((candidate) => candidate.id === id);
      return guide
        ? [{ id: guide.id, originalFilename: guide.originalFilename, url: base + guide.path }]
        : [];
    }),
    styleGuidesChanged:
      m.styleGuideSelection.length !== m.appliedStyleGuideSet.length ||
      m.styleGuideSelection.some((id) => !m.appliedStyleGuideSet.includes(id)),
    spriteAcquisition: m.spriteAcquisition,
    spritePaletteLock: m.spritePaletteLock,
    backgroundSuitability: m.backgroundSuitability,
    motionPrompt: m.motionPrompt,
    motionModel: m.motionModel,
    paletteLock: m.paletteLock,
    spriteUrl: m.sprite ? base + m.sprite : null,
    spriteDimensions: m.spriteDimensions,
    targetFrameSize: m.targetFrameSize ?? null,
    subjectFillPct: m.subjectFillPct ?? null,
    colorCount: m.colorCount ?? null,
    subjectFillMeasured: m.subjectFillMeasured ?? null,
    frames: m.frames.map((f) => base + f),
    selectedFrameIndices: m.selectedFrameIndices,
    sourceVideoUrl: m.frames.length > 0 ? base + PROJECT_FILES.source : null,
    spritesheetUrl: m.spritesheet ? base + m.spritesheet : null,
    previewGifUrl: m.previewGif ? base + m.previewGif : null,
    updatedAt: m.updatedAt,
  };
}

export async function pruneUnreferencedStyleGuides(
  manifest: ProjectManifest,
): Promise<ProjectManifest> {
  const referenced = new Set([
    ...manifest.styleGuideSelection,
    ...manifest.appliedStyleGuideSet,
  ]);
  const retained = manifest.styleGuideImages.filter((guide) => referenced.has(guide.id));
  const removed = manifest.styleGuideImages.filter((guide) => !referenced.has(guide.id));
  if (removed.length === 0) return manifest;

  await Promise.all(
    removed.map(async (guide) => {
      const absolutePath = path.join(LATEST_DIR, guide.path);
      ensureInsideRoot(absolutePath);
      await rm(absolutePath, { force: true });
    }),
  );
  return writeManifest("latest", { ...manifest, styleGuideImages: retained });
}

export async function wipeLatestFramesAndSheet(): Promise<void> {
  const framesDir = path.join(LATEST_DIR, PROJECT_FILES.framesDir);
  if (existsSync(framesDir)) {
    await rm(framesDir, { recursive: true, force: true });
  }
  await wipeLatestSpritesheet();
}

export async function wipeLatestSpritesheet(): Promise<void> {
  const sheet = path.join(LATEST_DIR, PROJECT_FILES.spritesheet);
  if (existsSync(sheet)) await rm(sheet);
  const gif = path.join(LATEST_DIR, PROJECT_FILES.previewGif);
  if (existsSync(gif)) await rm(gif);
}

export async function listSavedProjects(): Promise<{ name: string; updatedAt: string }[]> {
  if (!existsSync(PROJECTS_DIR)) return [];
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const out: { name: string; updatedAt: string }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "latest") continue;
    try {
      const m = await readManifest(entry.name);
      out.push({ name: entry.name, updatedAt: m.updatedAt });
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

export async function saveLatestAs(name: string): Promise<ProjectView> {
  safeProjectName(name);
  if (!existsSync(LATEST_DIR)) {
    throw new Error("nothing to save — generate a sprite first");
  }
  // Stamp the new name into latest before snapshotting, so both manifests agree.
  const lm = await readManifest("latest");
  lm.name = name;
  await writeManifest("latest", lm);

  const target = projectDir(name);
  if (existsSync(target)) {
    await rm(target, { recursive: true, force: true });
  }
  await cp(LATEST_DIR, target, {
    recursive: true,
    filter: (source) => path.basename(source) !== ".tmp-upload",
  });

  return toView(await readManifest("latest"));
}

export async function loadProjectIntoLatest(name: string): Promise<ProjectView> {
  safeProjectName(name);
  const source = projectDir(name);
  if (!existsSync(source)) throw new Error(`project '${name}' not found`);
  if (existsSync(LATEST_DIR)) {
    await rm(LATEST_DIR, { recursive: true, force: true });
  }
  await cp(source, LATEST_DIR, { recursive: true });
  // Keep the loaded project's name on the latest manifest so the UI knows what it's working on.
  return toView(await readManifest("latest"));
}

export async function deleteSavedProject(name: string): Promise<void> {
  safeProjectName(name);
  const target = projectDir(name);
  if (existsSync(target)) {
    await rm(target, { recursive: true, force: true });
  }
}
