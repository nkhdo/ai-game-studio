import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { buildGifFromFramePaths } from "./build-gif.js";
import { activeProjectDir, activeProjectId, PROJECT_FILES, ensureInsideRoot, saveDataUrlPng } from "./files.js";
import {
  readManifest,
  toView,
  updateLatest,
  type AnimationManifest,
  type ProjectView,
} from "./projects.js";

export interface AnimationInput {
  name: string;
  frameIndices: number[];
  fps: number;
  dataUrl: string;
  sourceAnimationId?: string;
}

export function validateAnimationInput(input: AnimationInput, frameCount: number): AnimationInput {
  const name = input.name.trim();
  if (!name || name.length > 40) throw new Error("animation name must be 1–40 characters");
  if (!Array.isArray(input.frameIndices) || input.frameIndices.length === 0) {
    throw new Error("select at least one frame");
  }
  if (input.frameIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= frameCount)) {
    throw new Error("animation contains an invalid frame index");
  }
  if (!Number.isInteger(input.fps) || input.fps < 1 || input.fps > 60) {
    throw new Error("animation fps must be an integer from 1 to 60");
  }
  if (
    typeof input.dataUrl !== "string" ||
    input.dataUrl.length > 50_000_000 ||
    !/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(input.dataUrl)
  ) {
    throw new Error("invalid spritesheet data");
  }
  return { ...input, name };
}

export function ensureUniqueAnimationName(
  animations: AnimationManifest[],
  name: string,
  exceptId?: string,
) {
  if (animations.some((animation) => animation.id !== exceptId && animation.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error(`animation '${name}' already exists`);
  }
}

async function materializeAnimation(
  id: string,
  input: AnimationInput,
  createdAt: string,
  sourceFrames?: string[],
): Promise<AnimationManifest> {
  const manifest = await readManifest(activeProjectId());
  const frameCount = sourceFrames
    ? Math.max(0, ...input.frameIndices.map((index) => index + 1))
    : manifest.frames.length;
  const validated = validateAnimationInput(input, frameCount);
  if (sourceFrames && sourceFrames.length !== validated.frameIndices.length) {
    throw new Error("saved Animation frame sequence is inconsistent");
  }
  const relativeDir = `${PROJECT_FILES.animationsDir}/${id}`;
  const absoluteDir = path.join(activeProjectDir(), relativeDir);
  ensureInsideRoot(absoluteDir);
  const sourcePaths = validated.frameIndices.map((frameIndex, position) =>
    path.join(activeProjectDir(), sourceFrames?.[position] ?? manifest.frames[frameIndex])
  );
  for (const [position, source] of sourcePaths.entries()) {
    ensureInsideRoot(source);
    if (!existsSync(source)) {
      throw new Error(`Movement Frame ${validated.frameIndices[position] + 1} is missing`);
    }
  }
  await rm(absoluteDir, { recursive: true, force: true });
  await mkdir(path.join(absoluteDir, "frames"), { recursive: true });

  const frozenFrames: string[] = [];
  for (const [position] of validated.frameIndices.entries()) {
    const source = sourcePaths[position];
    const relative = `${relativeDir}/frames/frame-${String(position + 1).padStart(5, "0")}.png`;
    const target = path.join(activeProjectDir(), relative);
    ensureInsideRoot(target);
    await copyFile(source, target);
    frozenFrames.push(relative);
  }

  const spritesheet = `${relativeDir}/spritesheet.png`;
  await saveDataUrlPng(validated.dataUrl, path.join(activeProjectDir(), spritesheet));
  const previewGif = `${relativeDir}/preview.gif`;
  let savedPreview: string | null = previewGif;
  try {
    await buildGifFromFramePaths(
      frozenFrames.map((frame) => path.join(activeProjectDir(), frame)),
      path.join(activeProjectDir(), previewGif),
      manifest.targetFrameSize?.w ?? 128,
      validated.fps,
    );
  } catch (error) {
    savedPreview = null;
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[api] animation preview gif build failed:", message);
  }

  const now = new Date().toISOString();
  return {
    id,
    name: validated.name,
    frameIndices: [...validated.frameIndices],
    frames: frozenFrames,
    fps: validated.fps,
    spritesheet,
    previewGif: savedPreview,
    createdAt,
    updatedAt: now,
  };
}

export async function createAnimation(input: AnimationInput): Promise<ProjectView> {
  const manifest = await readManifest(activeProjectId());
  const sourceAnimation = input.sourceAnimationId
    ? manifest.animations.find((animation) => animation.id === input.sourceAnimationId)
    : undefined;
  if (input.sourceAnimationId && !sourceAnimation) throw new Error("source Animation not found");
  const frameCount = sourceAnimation
    ? Math.max(0, ...input.frameIndices.map((index) => index + 1))
    : manifest.frames.length;
  const validated = validateAnimationInput(input, frameCount);
  ensureUniqueAnimationName(manifest.animations, validated.name);
  const now = new Date().toISOString();
  const animation = await materializeAnimation(randomUUID(), validated, now, sourceAnimation?.frames);
  return toView(await updateLatest({ animations: [...manifest.animations, animation] }));
}

export async function updateAnimation(id: string, input: AnimationInput): Promise<ProjectView> {
  const manifest = await readManifest(activeProjectId());
  const existing = manifest.animations.find((animation) => animation.id === id);
  if (!existing) throw new Error("animation not found");
  if (input.sourceAnimationId === id) {
    const validated = validateAnimationInput(
      input,
      Math.max(manifest.frames.length, ...existing.frameIndices.map((index) => index + 1)),
    );
    ensureUniqueAnimationName(manifest.animations, validated.name, id);
    const spritesheetPath = path.join(activeProjectDir(), existing.spritesheet);
    await saveDataUrlPng(validated.dataUrl, spritesheetPath);
    let previewGif: string | null = existing.previewGif ?? `${PROJECT_FILES.animationsDir}/${id}/preview.gif`;
    try {
      await buildGifFromFramePaths(
        existing.frames.map((frame) => path.join(activeProjectDir(), frame)),
        path.join(activeProjectDir(), previewGif),
        manifest.targetFrameSize?.w ?? 128,
        validated.fps,
      );
    } catch {
      previewGif = null;
    }
    const updated = {
      ...existing,
      name: validated.name,
      fps: validated.fps,
      previewGif,
      updatedAt: new Date().toISOString(),
    };
    return toView(await updateLatest({
      animations: manifest.animations.map((candidate) => candidate.id === id ? updated : candidate),
    }));
  }
  const validated = validateAnimationInput(input, manifest.frames.length);
  ensureUniqueAnimationName(manifest.animations, validated.name, id);
  const animation = await materializeAnimation(id, validated, existing.createdAt);
  return toView(await updateLatest({
    animations: manifest.animations.map((candidate) => candidate.id === id ? animation : candidate),
  }));
}

export async function deleteAnimation(id: string): Promise<ProjectView> {
  const manifest = await readManifest(activeProjectId());
  const existing = manifest.animations.find((animation) => animation.id === id);
  if (!existing) throw new Error("animation not found");
  const target = path.join(activeProjectDir(), PROJECT_FILES.animationsDir, id);
  ensureInsideRoot(target);
  await rm(target, { recursive: true, force: true });
  return toView(await updateLatest({
    animations: manifest.animations.filter((animation) => animation.id !== id),
    ...(id === "legacy" ? { spritesheet: null, previewGif: null } : {}),
  }));
}
