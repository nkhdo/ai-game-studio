import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { activeProjectDir, PROJECT_FILES, ensureInsideRoot } from "./files.js";

export async function buildPreviewGif(
  selectedIndices: number[],
  frameSize: number,
  fps = 12,
): Promise<string> {
  const framesDir = path.join(activeProjectDir(), PROJECT_FILES.framesDir);
  ensureInsideRoot(framesDir);
  if (!existsSync(framesDir)) {
    throw new Error("no frames directory");
  }

  const allFiles = (await readdir(framesDir))
    .filter((f) => f.endsWith(".png"))
    .sort();

  const sortedIndices = [...selectedIndices].sort((a, b) => a - b);
  const selected = sortedIndices
    .filter((i) => Number.isInteger(i) && i >= 0 && i < allFiles.length)
    .map((i) => allFiles[i]);

  if (selected.length === 0) {
    throw new Error("no frames selected for gif");
  }

  const selectedPaths = selected.map((name) => path.join(framesDir, name));
  const outputPath = path.join(activeProjectDir(), PROJECT_FILES.previewGif);
  await buildGifFromFramePaths(selectedPaths, outputPath, frameSize, fps);
  return PROJECT_FILES.previewGif;
}

export async function buildGifFromFramePaths(
  framePaths: string[],
  outputPath: string,
  frameSize: number,
  fps = 12,
): Promise<void> {
  if (framePaths.length === 0) throw new Error("no frames selected for gif");
  ensureInsideRoot(outputPath);
  for (const framePath of framePaths) ensureInsideRoot(framePath);

  const tmpDir = path.join(activeProjectDir(), `.tmp-gif-${randomUUID()}`);
  ensureInsideRoot(tmpDir);
  await mkdir(tmpDir, { recursive: true });

  await Promise.all(
    framePaths.map((src, i) => {
      const dst = path.join(tmpDir, `frame-${String(i + 1).padStart(5, "0")}.png`);
      return copyFile(src, dst);
    }),
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  if (existsSync(outputPath)) await rm(outputPath);

  const filter = previewGifFilter(frameSize);

  try {
    await new Promise<void>((resolve, reject) => {
      const args = [
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-framerate", String(fps),
        "-f", "image2",
        "-i", path.join(tmpDir, "frame-%05d.png"),
        "-vf", filter,
        "-loop", "0",
        outputPath,
      ];
      const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg gif exited with ${code}`)),
      );
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export function previewGifFilter(frameSize: number): string {
  return (
    `scale=${frameSize}:${frameSize}:force_original_aspect_ratio=decrease,` +
    `pad=${frameSize}:${frameSize}:(ow-iw)/2:(oh-ih)/2:color=black@0,` +
    "split [a][b]; [a] palettegen=reserve_transparent=on [p]; " +
    "[b][p] paletteuse=dither=bayer:bayer_scale=5"
  );
}
