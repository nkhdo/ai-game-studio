import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  extractSubjectPalette,
  remapFramesToPalette,
  type FrameProcessingStats,
} from "./palette-lock.js";
import { ROOT_DIR, ensureInsideRoot } from "./files.js";

export interface ExtractFramesOptions {
  /** Reference Sprite bytes; when set, extracted frames are remapped to its Subject Palette. */
  referenceSprite?: Buffer;
  /** Convert extracted antialiased edges to binary transparency. */
  hardAlphaEdges?: boolean;
}

export interface ExtractFramesResult extends FrameProcessingStats {
  files: string[];
}

export async function resizeExtractedFrames(
  outputDir: string,
  files: string[],
  frameSize: number,
): Promise<void> {
  for (const entry of files) {
    const file = path.join(outputDir, entry);
    const resized = await sharp(await readFile(file))
      .resize(frameSize, frameSize, {
        fit: "contain",
        kernel: "nearest",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    await writeFile(file, resized);
  }
}

export async function extractFrames(
  inputMp4: string,
  outputDir: string,
  frameSize: number,
  options: ExtractFramesOptions = {},
): Promise<ExtractFramesResult> {
  ensureInsideRoot(inputMp4);
  ensureInsideRoot(outputDir);
  if (!existsSync(inputMp4)) {
    throw new Error("input video not found");
  }

  if (existsSync(outputDir)) {
    const existing = await readdir(outputDir);
    for (const f of existing) {
      if (f.endsWith(".png")) await rm(path.join(outputDir, f));
    }
  } else {
    await mkdir(outputDir, { recursive: true });
  }

  const scriptPath = path.join(ROOT_DIR, "scripts", "extract-frames.sh");

  await new Promise<void>((resolve, reject) => {
    const child = spawn("bash", [scriptPath, inputMp4, outputDir], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`extract-frames.sh exited with code ${code}`));
    });
  });

  const entries = await readdir(outputDir);
  const frames = entries.filter((f) => f.endsWith(".png")).sort();
  if (frames.length === 0) {
    throw new Error("no frames produced");
  }

  let stats: FrameProcessingStats = {
    preservedOffPalettePixels: 0,
    removedLowAlphaPixels: 0,
    removedChromaFringePixels: 0,
  };
  if (options.referenceSprite || options.hardAlphaEdges) {
    const palette = options.referenceSprite
      ? await extractSubjectPalette(options.referenceSprite)
      : null;
    stats = await remapFramesToPalette(outputDir, palette, {
      hardAlphaEdges: options.hardAlphaEdges,
    });
  }

  // Palette neighborhoods are evaluated at the video's native resolution.
  // Resize only after colors and alpha have been finalized.
  await resizeExtractedFrames(outputDir, frames, frameSize);

  return { files: frames, ...stats };
}
