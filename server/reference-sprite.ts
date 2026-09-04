import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ensureInsideRoot, LATEST_DIR, PROJECT_FILES } from "./files.js";
import {
  pruneUnreferencedStyleGuides,
  readManifest,
  toView,
  updateLatest,
  wipeLatestFramesAndSheet,
} from "./projects.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16_000_000;
const PREPARED_UPLOAD_TTL_MS = 15 * 60 * 1000;
const CHROMA = { r: 0, g: 177, b: 64 } as const;
const PREPARED_DIR = path.join(LATEST_DIR, ".tmp-upload");
const PREPARED_IMAGE = path.join(PREPARED_DIR, "sprite.png");
const PREPARED_META = path.join(PREPARED_DIR, "upload.json");
let preparedExpiryTimer: NodeJS.Timeout | null = null;

export type BackgroundSuitability = "suitable" | "warning" | "unknown";
export type SpriteAcquisition = "generated" | "uploaded";

export const TARGET_FRAME_SIZES = [32, 64, 128, 192, 256] as const;
export const SUBJECT_FILL_OPTIONS = [50, 70, 85] as const;
export const COLOR_COUNT_OPTIONS = [4, 8, 16, 32] as const;
export const DEFAULT_TARGET_FRAME_SIZE = 128;
export const DEFAULT_SUBJECT_FILL_PCT = 70;
export const DEFAULT_COLOR_COUNT = 16;
export const SUBJECT_FILL_TOLERANCE_PCT = 10;

export interface TargetGeometry {
  targetFrameSize: { w: number; h: number };
  subjectFillPct: number;
  // null = keep the full generated palette ("Off" in the UI).
  colorCount: number | null;
}

export function parseTargetGeometry(input: {
  frameSize?: unknown;
  subjectFillPct?: unknown;
  colorCount?: unknown;
}): TargetGeometry {
  const frameSize = input.frameSize;
  if (typeof frameSize !== "number" || !(TARGET_FRAME_SIZES as readonly number[]).includes(frameSize)) {
    throw new Error(
      `unsupported target frame size (use one of ${TARGET_FRAME_SIZES.join(", ")})`,
    );
  }
  const subjectFillPct = input.subjectFillPct;
  if (typeof subjectFillPct !== "number" || !(SUBJECT_FILL_OPTIONS as readonly number[]).includes(subjectFillPct)) {
    throw new Error(
      `unsupported subject fill (use one of ${SUBJECT_FILL_OPTIONS.join(", ")})`,
    );
  }
  let colorCount: number | null = null;
  if (input.colorCount !== null && input.colorCount !== undefined) {
    if (typeof input.colorCount !== "number" || !(COLOR_COUNT_OPTIONS as readonly number[]).includes(input.colorCount)) {
      throw new Error(
        `unsupported color count (use one of ${COLOR_COUNT_OPTIONS.join(", ")} or null)`,
      );
    }
    colorCount = input.colorCount;
  }
  return {
    targetFrameSize: { w: frameSize, h: frameSize },
    subjectFillPct,
    colorCount,
  };
}

interface PreparedMetadata {
  uploadId: string;
  originalFilename: string;
  dimensions: { w: number; h: number };
  backgroundSuitability: BackgroundSuitability;
  targetFrameSize: { w: number; h: number };
  subjectFillPct: number;
  colorCount: number | null;
  subjectFillMeasured: number | null;
  preparedAt: string;
}

export interface PreparedUpload extends PreparedMetadata {
  requiresConfirmation: boolean;
}

export interface NormalizedReferenceImage {
  buffer: Buffer;
  dimensions: { w: number; h: number };
  backgroundSuitability: BackgroundSuitability;
}

export function sanitizeDisplayFilename(value: string): string {
  const basename = path.basename(value.replace(/\\/g, "/"));
  const cleaned = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "uploaded-image").slice(0, 120);
}

export function assertAllowedFormat(format: string | undefined): void {
  if (!format || !["png", "jpeg", "webp"].includes(format)) {
    throw new Error("unsupported image format (use PNG, JPEG, or WebP)");
  }
}

export function assertDimensions(width: number | undefined, height: number | undefined): asserts width is number {
  if (!width || !height) throw new Error("could not read image dimensions");
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new Error("image is too large (maximum 4096 px per side and 16 megapixels)");
  }
}

export async function assessBackground(buffer: Buffer): Promise<BackgroundSuitability> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(128, 128, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const distances: number[] = [];
    const channels = info.channels;
    const addPixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * channels;
      const dr = data[offset] - CHROMA.r;
      const dg = data[offset + 1] - CHROMA.g;
      const db = data[offset + 2] - CHROMA.b;
      distances.push(Math.sqrt(dr * dr + dg * dg + db * db));
    };
    for (let x = 0; x < info.width; x += 2) {
      addPixel(x, 0);
      addPixel(x, info.height - 1);
    }
    for (let y = 2; y < info.height - 2; y += 2) {
      addPixel(0, y);
      addPixel(info.width - 1, y);
    }
    const closeRatio = distances.filter((distance) => distance <= 45).length / distances.length;
    const mean = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    const variance =
      distances.reduce((sum, distance) => sum + (distance - mean) ** 2, 0) /
      distances.length;
    return closeRatio >= 0.65 && Math.sqrt(variance) <= 35 ? "suitable" : "warning";
  } catch {
    return "unknown";
  }
}

export async function normalizeReferenceImage(source: Buffer): Promise<NormalizedReferenceImage> {
  const metadata = await sharp(source, { failOn: "error" }).metadata();
  assertAllowedFormat(metadata.format);
  assertDimensions(metadata.width, metadata.height);
  const buffer = await sharp(source, { failOn: "error" })
    .autoOrient()
    .flatten({ background: CHROMA })
    .png()
    .toBuffer();
  const normalizedMetadata = await sharp(buffer).metadata();
  assertDimensions(normalizedMetadata.width, normalizedMetadata.height);
  return {
    buffer,

    dimensions: { w: normalizedMetadata.width!, h: normalizedMetadata.height! },
    backgroundSuitability: await assessBackground(buffer),
  };
}

export interface AppliedGeometry {
  buffer: Buffer;
  dimensions: { w: number; h: number };
  subjectFillMeasured: number | null;
  backgroundSuitability: BackgroundSuitability;
}

// Forces the Reference Sprite to the exact Target Frame Size: nearest-neighbor
// contain-fit (never stretches the subject) with letterboxing on flat chroma
// green, then optional palette quantization. The key color is re-assessed on
// the final buffer so a quantizer that shifted the green is caught.
export async function applyTargetGeometry(
  source: Buffer,
  target: TargetGeometry,
): Promise<AppliedGeometry> {
  const { w, h } = target.targetFrameSize;
  let pipeline = sharp(source, { failOn: "error" }).resize(w, h, {
    fit: "contain",
    kernel: "nearest",
    background: CHROMA,
  });
  pipeline =
    target.colorCount === null
      ? pipeline.png()
      : pipeline.png({ palette: true, colours: target.colorCount, dither: 0 });
  const buffer = await pipeline.flatten({ background: CHROMA }).toBuffer();
  return {
    buffer,
    dimensions: { w, h },
    subjectFillMeasured: await measureSubjectFill(buffer),
    backgroundSuitability: await assessBackground(buffer),
  };
}

// Chroma-keyed bounding box: fraction of the frame height occupied by the
// subject. Returns null when no subject is found or measurement fails.
async function measureSubjectFill(buffer: Buffer): Promise<number | null> {
  try {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    let minY = height;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        if (data[offset + 3] === 0) continue;
        const dr = data[offset] - CHROMA.r;
        const dg = data[offset + 1] - CHROMA.g;
        const db = data[offset + 2] - CHROMA.b;
        if (Math.sqrt(dr * dr + dg * dg + db * db) > 45) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          break;
        }
      }
    }
    if (maxY < 0) return null;
    return Math.round(((maxY - minY + 1) / height) * 100);
  } catch {
    return null;
  }
}

export async function prepareReferenceUpload(
  source: Buffer,
  originalFilename: string,
  target: TargetGeometry,
): Promise<PreparedUpload> {
  if (source.length === 0) throw new Error("image file is required");
  if (source.length > MAX_UPLOAD_BYTES) throw new Error("image is too large (maximum 10 MB)");

  const normalized = await normalizeReferenceImage(source);
  const applied = await applyTargetGeometry(normalized.buffer, target);

  const prepared: PreparedMetadata = {
    uploadId: randomUUID(),
    originalFilename: sanitizeDisplayFilename(originalFilename),
    dimensions: applied.dimensions,
    backgroundSuitability: applied.backgroundSuitability,
    targetFrameSize: target.targetFrameSize,
    subjectFillPct: target.subjectFillPct,
    colorCount: target.colorCount,
    subjectFillMeasured: applied.subjectFillMeasured,
    preparedAt: new Date().toISOString(),
  };

  ensureInsideRoot(PREPARED_DIR);
  await rm(PREPARED_DIR, { recursive: true, force: true });
  await mkdir(PREPARED_DIR, { recursive: true });
  await Promise.all([
    writeFile(PREPARED_IMAGE, applied.buffer),
    writeFile(PREPARED_META, JSON.stringify(prepared, null, 2)),
  ]);
  if (preparedExpiryTimer) clearTimeout(preparedExpiryTimer);
  preparedExpiryTimer = setTimeout(() => {
    void discardPreparedUpload().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[upload] failed to clean expired prepared upload:", message);
    });
  }, PREPARED_UPLOAD_TTL_MS);
  preparedExpiryTimer.unref();

  const manifest = await readManifest("latest");
  return {
    ...prepared,
    requiresConfirmation:
      manifest.frames.length > 0 || Boolean(manifest.spritesheet || manifest.previewGif),
  };
}

async function readPrepared(uploadId: string): Promise<PreparedMetadata> {
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw new Error("invalid prepared upload");
  if (!existsSync(PREPARED_META) || !existsSync(PREPARED_IMAGE)) {
    throw new Error("prepared upload not found or expired");
  }
  const [raw, fileStat] = await Promise.all([readFile(PREPARED_META, "utf8"), stat(PREPARED_META)]);
  if (Date.now() - fileStat.mtimeMs > PREPARED_UPLOAD_TTL_MS) {
    await discardPreparedUpload();
    throw new Error("prepared upload not found or expired");
  }
  const prepared = JSON.parse(raw) as PreparedMetadata;
  if (prepared.uploadId !== uploadId) throw new Error("prepared upload not found or expired");
  return prepared;
}

export async function commitReferenceUpload(uploadId: string) {
  const prepared = await readPrepared(uploadId);
  const refAbs = path.join(LATEST_DIR, PROJECT_FILES.ref);
  ensureInsideRoot(refAbs);
  await mkdir(path.dirname(refAbs), { recursive: true });
  await rename(PREPARED_IMAGE, refAbs);
  await wipeLatestFramesAndSheet();
  await discardPreparedUpload();

  let manifest = await updateLatest({
    spritePrompt: "",
    spriteAcquisition: "uploaded",
    appliedStyleGuideSet: [],
    spriteOriginalFilename: prepared.originalFilename,
    backgroundSuitability: prepared.backgroundSuitability,
    sprite: PROJECT_FILES.ref,
    spriteDimensions: prepared.dimensions,
    targetFrameSize: prepared.targetFrameSize,
    subjectFillPct: prepared.subjectFillPct,
    colorCount: prepared.colorCount,
    subjectFillMeasured: prepared.subjectFillMeasured,
    frames: [],
    selectedFrameIndices: [],
    spritesheet: null,
    previewGif: null,
    preservedOffPalettePixels: null,
    removedLowAlphaPixels: null,
  });
  manifest = await pruneUnreferencedStyleGuides(manifest);
  return toView(manifest);
}

export async function discardPreparedUpload(): Promise<void> {
  if (preparedExpiryTimer) {
    clearTimeout(preparedExpiryTimer);
    preparedExpiryTimer = null;
  }
  ensureInsideRoot(PREPARED_DIR);
  await rm(PREPARED_DIR, { recursive: true, force: true });
}
