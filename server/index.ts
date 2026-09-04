import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  generateSpriteImage,
  isImageModelId,
} from "./image.js";
import {
  addStyleGuideImage,
  readSelectedStyleGuideDataUrls,
  removeStyleGuideImage,
} from "./style-guides.js";
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODELS,
  defaultDurationFor,
  generateSpriteMotionVideo,
  isVideoModelId,
  normalizeVideoInput,
} from "./video.js";
import { extractFrames } from "./extract-frames.js";
import { buildPreviewGif } from "./build-gif.js";
import {
  LATEST_DIR,
  PROJECTS_DIR,
  PROJECT_FILES,
  downloadVideo,
  ensureInsideRoot,
  readPngDims,
  saveBase64Image,
  saveDataUrlPng,
} from "./files.js";
import {
  deleteSavedProject,
  emptyManifest,
  listSavedProjects,
  loadProjectIntoLatest,
  readManifest,
  saveLatestAs,
  pruneUnreferencedStyleGuides,
  toView,
  updateLatest,
  wipeLatestAnimations,
  wipeLatestFramesAndSheet,
  wipeLatestMotionArtifacts,
  wipeLatestSpritesheet,
} from "./projects.js";
import {
  DEFAULT_TARGET_FRAME_SIZE,
  TARGET_FRAME_SIZES,
  commitReferenceUpload,
  discardPreparedUpload,
  normalizeReferenceImage,
  prepareReferenceUpload,
  applyTargetGeometry,
  parseTargetGeometry,
} from "./reference-sprite.js";
import { conformToReferencePalette, dataUrlToBuffer } from "./palette-lock.js";
import { createAnimation, deleteAnimation, updateAnimation } from "./animations.js";

const PORT = Number(process.env.PORT ?? 8787);
const HAS_KEY = Boolean(process.env.OPENROUTER_API_KEY);

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use("/projects", express.static(PROJECTS_DIR, { fallthrough: false }));
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 10 * 1024 * 1024 },
});

function requireKey(_req: Request, res: Response, next: NextFunction) {
  if (!HAS_KEY) {
    res.status(500).json({
      error: "OPENROUTER_API_KEY is not configured. Add it to .env and restart the server.",
    });
    return;
  }
  next();
}

function asString(v: unknown, name: string, max = 2_000): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  if (v.length > max) throw new Error(`${name} is too long`);
  return v.trim();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasApiKey: HAS_KEY });
});

app.get("/api/models/video", (_req, res) => {
  res.json({ models: VIDEO_MODELS, default: DEFAULT_VIDEO_MODEL });
});

app.get("/api/models/image", (_req, res) => {
  res.json({ models: IMAGE_MODELS, default: DEFAULT_IMAGE_MODEL });
});

app.get("/api/projects/current", async (_req, res) => {
  try {
    res.json(toView(await readManifest("latest")));
  } catch (err) {
    handleError(err, res);
  }
});

app.get("/api/projects", async (_req, res) => {
  try {
    res.json(await listSavedProjects());
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/save", async (req, res) => {
  try {
    const name = asString(req.body?.name, "name", 40);
    res.json(await saveLatestAs(name));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/load", async (req, res) => {
  try {
    const name = asString(req.body?.name, "name", 40);
    res.json(await loadProjectIntoLatest(name));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/new", async (_req, res) => {
  try {
    if (existsSync(LATEST_DIR)) {
      await rm(LATEST_DIR, { recursive: true, force: true });
    }
    res.json(toView(emptyManifest("latest")));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/delete", async (req, res) => {
  try {
    const name = asString(req.body?.name, "name", 40);
    await deleteSavedProject(name);
    res.json({ ok: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/selection", async (req, res) => {
  try {
    const indices = req.body?.selectedIndices;
    if (!Array.isArray(indices) || indices.some((i) => typeof i !== "number")) {
      throw new Error("selectedIndices must be an array of numbers");
    }
    const m = await updateLatest({ selectedFrameIndices: indices });
    res.json(toView(m));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/spritesheet", async (req, res) => {
  try {
    const dataUrl = asString(req.body?.dataUrl, "dataUrl", 50_000_000);
    const spritesheetAbs = path.join(LATEST_DIR, PROJECT_FILES.spritesheet);
    await saveDataUrlPng(dataUrl, spritesheetAbs);

    let m = await updateLatest({ spritesheet: PROJECT_FILES.spritesheet });

    // Best-effort GIF build from current selection
    try {
      const gifName = await buildPreviewGif(
        m.selectedFrameIndices,
        m.targetFrameSize?.w ?? DEFAULT_TARGET_FRAME_SIZE,
      );
      m = await updateLatest({ previewGif: gifName });
    } catch (gifErr) {
      const msg = gifErr instanceof Error ? gifErr.message : String(gifErr);
      console.warn("[api] preview gif build failed:", msg);
      m = await updateLatest({ previewGif: null });
    }

    res.json(toView(m));
  } catch (err) {
    handleError(err, res);
  }
});

function animationInput(body: Record<string, unknown>) {
  return {
    name: typeof body.name === "string" ? body.name : "",
    frameIndices: Array.isArray(body.frameIndices) ? body.frameIndices as number[] : [],
    fps: Number(body.fps),
    dataUrl: typeof body.dataUrl === "string" ? body.dataUrl : "",
    sourceAnimationId: typeof body.sourceAnimationId === "string" ? body.sourceAnimationId : undefined,
  };
}

app.post("/api/projects/animations", async (req, res) => {
  try {
    res.json(await createAnimation(animationInput(req.body ?? {})));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/animations/update", async (req, res) => {
  try {
    const id = asString(req.body?.id, "animation id", 80);
    res.json(await updateAnimation(id, animationInput(req.body ?? {})));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/animations/delete", async (req, res) => {
  try {
    const id = asString(req.body?.id, "animation id", 80);
    res.json(await deleteAnimation(id));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/style-guides", imageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) throw new Error("image file is required");
    res.json(await addStyleGuideImage(req.file.buffer, req.file.originalname));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/style-guides/remove", async (req, res) => {
  try {
    const id = asString(req.body?.id, "id", 64);
    res.json(await removeStyleGuideImage(id));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/generate", requireKey, async (req, res) => {
  try {
    const prompt = asString(req.body?.prompt, "prompt");
    const requestedModel = req.body?.model;
    if (requestedModel !== undefined && !isImageModelId(requestedModel)) {
      throw new Error("unsupported image model");
    }
    const model = requestedModel ?? DEFAULT_IMAGE_MODEL;
    const spritePaletteLock = req.body?.spritePaletteLock === true;
    const geometry = parseTargetGeometry({
      frameSize: req.body?.frameSize,
      subjectFillPct: req.body?.subjectFillPct,
      colorCount: req.body?.colorCount ?? null,
    });
    const projectBeforeGeneration = await readManifest("latest");
    const styleGuideDataUrls = await readSelectedStyleGuideDataUrls(projectBeforeGeneration);
    let generatedBase64: string;
    try {
      generatedBase64 = await generateSpriteImage(prompt, model, {
        geometry: {
          size: geometry.targetFrameSize,
          subjectFillPct: geometry.subjectFillPct,
        },
        styleGuideDataUrls,
      });
    } catch (error) {
      if (projectBeforeGeneration.styleGuideSelection.length === 0) throw error;
      const filenames = projectBeforeGeneration.styleGuideSelection.flatMap((id) => {
        const guide = projectBeforeGeneration.styleGuideImages.find(
          (candidate) => candidate.id === id,
        );
        return guide ? [`'${guide.originalFilename}'`] : [];
      });
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Generation with Style Guide Images ${filenames.join(", ")} failed: ${message}`,
      );
    }
    // Palette Lock post-process: constrain the generated sprite to the union
    // palette of the Style Guide Images only. The uploaded Reference Sprite is
    // never part of the generation flow.
    const conformed = await conformToReferencePalette(
      Buffer.from(generatedBase64, "base64"),
      spritePaletteLock ? styleGuideDataUrls.map(dataUrlToBuffer) : [],
    );
    const normalized = await normalizeReferenceImage(conformed);
    const applied = await applyTargetGeometry(normalized.buffer, geometry);
    const base64 = applied.buffer.toString("base64");

    // A replacement sprite invalidates its video and every downstream artifact.
    await wipeLatestMotionArtifacts();
    await wipeLatestAnimations();

    const refAbs = path.join(LATEST_DIR, PROJECT_FILES.ref);
    await saveBase64Image(base64, refAbs);
    const buf = await readFile(refAbs);
    const dims = readPngDims(buf);

    let m = await updateLatest({
      spritePrompt: prompt,
      spriteModel: model,
      appliedStyleGuideSet: [...projectBeforeGeneration.styleGuideSelection],
      spritePaletteLock,
      spriteAcquisition: "generated",
      spriteOriginalFilename: null,
      backgroundSuitability: applied.backgroundSuitability,
      sprite: PROJECT_FILES.ref,
      spriteDimensions: dims ?? applied.dimensions,
      targetFrameSize: geometry.targetFrameSize,
      subjectFillPct: geometry.subjectFillPct,
      colorCount: geometry.colorCount,
      subjectFillMeasured: applied.subjectFillMeasured,
      sourceVideo: null,
      motionPrompt: "",
      motionModel: DEFAULT_VIDEO_MODEL,
      frames: [],
      selectedFrameIndices: [],
      spritesheet: null,
      previewGif: null,
      animations: [],
      preservedOffPalettePixels: null,
      removedLowAlphaPixels: null,
      removedChromaFringePixels: null,
    });
    m = await pruneUnreferencedStyleGuides(m);

    res.json({
      view: toView(m),
      dataUrl: `data:image/png;base64,${base64}`,
    });
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/upload/prepare", imageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) throw new Error("image file is required");
    const geometry = parseTargetGeometry({
      frameSize: req.body?.frameSize === undefined ? undefined : Number(req.body.frameSize),
      subjectFillPct:
        req.body?.subjectFillPct === undefined ? undefined : Number(req.body.subjectFillPct),
      colorCount:
        req.body?.colorCount === undefined || req.body.colorCount === ""
          ? null
          : Number(req.body.colorCount),
    });
    res.json(
      await prepareReferenceUpload(req.file.buffer, req.file.originalname, geometry),
    );
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/upload/commit", async (req, res) => {
  try {
    const uploadId = asString(req.body?.uploadId, "uploadId", 64);
    res.json(await commitReferenceUpload(uploadId));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/upload/discard", async (_req, res) => {
  try {
    await discardPreparedUpload();
    res.json({ ok: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/video", requireKey, async (req, res) => {
  try {
    const text = asString(req.body?.text, "text");
    const model = isVideoModelId(req.body?.model) ? req.body.model : DEFAULT_VIDEO_MODEL;
    const duration =
      typeof req.body?.duration === "number" ? req.body.duration : defaultDurationFor(model);

    const current = await readManifest("latest");
    if (!current.sprite || !current.targetFrameSize) {
      throw new Error("current Reference Sprite is missing applied target geometry");
    }
    if (
      current.targetFrameSize.w !== current.targetFrameSize.h ||
      !(TARGET_FRAME_SIZES as readonly number[]).includes(current.targetFrameSize.w)
    ) {
      throw new Error("current Reference Sprite has invalid applied target geometry");
    }
    const spriteAbs = path.join(LATEST_DIR, current.sprite);
    ensureInsideRoot(spriteAbs);
    if (!existsSync(spriteAbs)) throw new Error("Reference Sprite not found on disk");
    const spriteBuffer = await readFile(spriteAbs);
    const imageInput = await normalizeVideoInput(spriteBuffer, model);

    const video = await generateSpriteMotionVideo(
      imageInput.dataUrl,
      text,
      duration,
      model,
      false,
    );
    const videoAbs = path.join(LATEST_DIR, PROJECT_FILES.source);
    await mkdir(LATEST_DIR, { recursive: true });
    const tempDir = await mkdtemp(path.join(LATEST_DIR, ".tmp-video-"));
    const tempVideo = path.join(tempDir, PROJECT_FILES.source);
    try {
      await downloadVideo(video.url, tempVideo, video.headers);
      await rename(tempVideo, videoAbs);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    await wipeLatestFramesAndSheet();

    const m = await updateLatest({
      motionPrompt: text,
      motionModel: model,
      sourceVideo: PROJECT_FILES.source,
      frames: [],
      selectedFrameIndices: [],
      preservedOffPalettePixels: null,
      removedLowAlphaPixels: null,
      removedChromaFringePixels: null,
      spritesheet: null,
      previewGif: null,
    });

    res.json(toView(m));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/frames", async (req, res) => {
  try {
    const paletteLock = req.body?.paletteLock === true;
    const hardAlphaEdges = req.body?.hardAlphaEdges === true;
    const current = await readManifest("latest");
    if (!current.sprite || !current.targetFrameSize) {
      throw new Error("current Reference Sprite is missing applied target geometry");
    }
    if (
      current.targetFrameSize.w !== current.targetFrameSize.h ||
      !(TARGET_FRAME_SIZES as readonly number[]).includes(current.targetFrameSize.w)
    ) {
      throw new Error("current Reference Sprite has invalid applied target geometry");
    }

    if (!current.sourceVideo) throw new Error("generate a video before generating frames");
    const videoAbs = path.join(LATEST_DIR, current.sourceVideo);
    const spriteAbs = path.join(LATEST_DIR, current.sprite);
    ensureInsideRoot(videoAbs);
    ensureInsideRoot(spriteAbs);
    if (!existsSync(videoAbs)) throw new Error("generated source video not found on disk");
    if (!existsSync(spriteAbs)) throw new Error("Reference Sprite not found on disk");

    const spriteBuffer = await readFile(spriteAbs);
    const framesAbs = path.join(LATEST_DIR, PROJECT_FILES.framesDir);
    const tempRoot = await mkdtemp(path.join(LATEST_DIR, ".tmp-frames-"));
    const pendingFrames = path.join(tempRoot, "pending");
    const previousFrames = path.join(tempRoot, "previous");
    let extraction;
    try {
      extraction = await extractFrames(videoAbs, pendingFrames, current.targetFrameSize.w, {
        referenceSprite: paletteLock ? spriteBuffer : undefined,
        hardAlphaEdges,
      });
      const hadPreviousFrames = existsSync(framesAbs);
      if (hadPreviousFrames) await rename(framesAbs, previousFrames);
      try {
        await rename(pendingFrames, framesAbs);
      } catch (error) {
        if (hadPreviousFrames && existsSync(previousFrames)) {
          await rename(previousFrames, framesAbs);
        }
        throw error;
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
    await wipeLatestSpritesheet();
    const frames = extraction.files.map((file) => `${PROJECT_FILES.framesDir}/${file}`);
    const manifest = await updateLatest({
      frames,
      selectedFrameIndices: frames.map((_, index) => index),
      paletteLock,
      hardAlphaEdges,
      preservedOffPalettePixels: extraction.preservedOffPalettePixels,
      removedLowAlphaPixels: extraction.removedLowAlphaPixels,
      removedChromaFringePixels: extraction.removedChromaFringePixels,
      spritesheet: null,
      previewGif: null,
    });
    res.json(toView(manifest));
  } catch (err) {
    handleError(err, res);
  }
});

function handleError(err: unknown, res: Response) {
  const message =
    err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
      ? "image is too large (maximum 10 MB)"
      : err instanceof Error
        ? err.message
        : "Unknown error";
  const safe = redact(message);
  console.error("[api error]", safe);
  const maxClientErrorLength = 8_000;
  const clientMessage = safe.length > maxClientErrorLength
    ? `${safe.slice(0, maxClientErrorLength)}… [truncated]`
    : safe;
  res.status(400).json({ error: clientMessage });
}

function redact(msg: string): string {
  return msg
    .replace(/sk-or-[A-Za-z0-9_-]+/g, "***")
    .replace(/xai-[A-Za-z0-9_-]+/g, "***");
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  handleError(err, res);
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (!HAS_KEY) {
    console.warn("[server] WARNING: OPENROUTER_API_KEY is missing — endpoints will return 500");
  }
});
