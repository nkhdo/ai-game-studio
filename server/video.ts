// Image-to-video generation via OpenRouter /api/v1/videos with polling.
// Model: x-ai/grok-imagine-video
// Flow: submit job → poll polling_url every few seconds → on `completed`, return unsigned_urls[0]
import sharp from "sharp";
//
// The downloader in server/files.ts fetches the returned URL without auth, which works for
// the unsigned_urls returned by OpenRouter on completion. If unsigned_urls is missing we
// fall back to the authenticated content endpoint and inline the auth via a query param —
// see resolveDownloadableUrl below.

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface VideoModelConfig {
  id: string;
  label: string;
  defaultDuration: number;
  inputMode: "first-frame" | "reference";
  minInputWidth: number | null;
  minInputHeight: number | null;
  inputResizeKernel: "nearest";
  constraintNote: string | null;
}

export const VIDEO_MODELS = [
  {
    id: "x-ai/grok-imagine-video",
    label: "Grok Imagine Video",
    defaultDuration: 4,
    inputMode: "first-frame",
    minInputWidth: 300,
    minInputHeight: null,
    inputResizeKernel: "nearest",
    constraintNote: "Observed provider rejection for inputs narrower than 300 px (2026-09-02).",
  },
  {
    id: "minimax/hailuo-3",
    label: "MiniMax H3",
    defaultDuration: 4,
    inputMode: "first-frame",
    minInputWidth: null,
    minInputHeight: null,
    inputResizeKernel: "nearest",
    constraintNote: null,
  },
  {
    id: "bytedance/seedance-2.0",
    label: "Seedance 2.0",
    defaultDuration: 4,
    inputMode: "first-frame",
    minInputWidth: null,
    minInputHeight: null,
    inputResizeKernel: "nearest",
    constraintNote: null,
  },
  {
    id: "bytedance/seedance-2.0-mini",
    label: "Seedance 2.0 Mini",
    defaultDuration: 4,
    inputMode: "first-frame",
    minInputWidth: 300,
    minInputHeight: null,
    inputResizeKernel: "nearest",
    constraintNote: null,
  },
  {
    id: "bytedance/seedance-2.5",
    label: "Seedance 2.5",
    defaultDuration: 4,
    inputMode: "first-frame",
    minInputWidth: 300,
    minInputHeight: null,
    inputResizeKernel: "nearest",
    constraintNote: null,
  },
] as const satisfies readonly VideoModelConfig[];

export type VideoModelId = (typeof VIDEO_MODELS)[number]["id"];

export const DEFAULT_VIDEO_MODEL: VideoModelId = "x-ai/grok-imagine-video";

export function isVideoModelId(v: unknown): v is VideoModelId {
  return typeof v === "string" && VIDEO_MODELS.some((m) => m.id === v);
}

export function defaultDurationFor(id: VideoModelId): number {
  return VIDEO_MODELS.find((m) => m.id === id)!.defaultDuration;
}

export function videoModelConfig(id: VideoModelId): VideoModelConfig {
  return VIDEO_MODELS.find((model) => model.id === id)!;
}

export interface NormalizedVideoInput {
  dataUrl: string;
  sourceDimensions: { w: number; h: number };
  inputDimensions: { w: number; h: number };
}

export async function normalizeVideoInput(
  source: Buffer,
  model: VideoModelId,
): Promise<NormalizedVideoInput> {
  const metadata = await sharp(source, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("could not read Reference Sprite dimensions");
  const config = videoModelConfig(model);
  const widthRatio = config.minInputWidth ? config.minInputWidth / metadata.width : 1;
  const heightRatio = config.minInputHeight ? config.minInputHeight / metadata.height : 1;
  const multiplier = Math.max(1, Math.ceil(widthRatio), Math.ceil(heightRatio));
  const w = metadata.width * multiplier;
  const h = metadata.height * multiplier;
  const buffer = multiplier === 1
    ? await sharp(source).png().toBuffer()
    : await sharp(source).resize(w, h, { kernel: config.inputResizeKernel }).png().toBuffer();
  return {
    dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    sourceDimensions: { w: metadata.width, h: metadata.height },
    inputDimensions: { w, h },
  };
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 100; // ~5 min cap

const CHROMA_DIRECTIVE =
  "Maintain the exact same flat solid pure chroma green background, " +
  "hex #00b140, throughout the entire clip. No background changes, no " +
  "environmental elements, no shadows on the background, no camera movement. " +
  "The subject animates against the uniform green backdrop.";

const PALETTE_DIRECTIVE =
  "Use only the colors present in the provided reference image for the subject, " +
  "its shading, highlights, and outlines. Do not introduce new colors. " +
  "Keep the chroma-green background unchanged.";

type JobStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

interface VideoJob {
  id: string;
  status: JobStatus;
  polling_url?: string;
  unsigned_urls?: string[];
  generation_id?: string;
  error?: string | { message?: string };
}

interface ErrorResponse {
  error?: string | { message?: string };
}

export interface VideoDownload {
  url: string;
  headers?: Record<string, string>;
}

export async function generateSpriteMotionVideo(
  image: string,
  text: string,
  duration = 2,
  model: VideoModelId = DEFAULT_VIDEO_MODEL,
  paletteLock = false,
): Promise<VideoDownload> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const fullText = paletteLock
    ? `${text.trim()}\n\n${CHROMA_DIRECTIVE}\n\n${PALETTE_DIRECTIVE}`
    : `${text.trim()}\n\n${CHROMA_DIRECTIVE}`;
  const config = videoModelConfig(model);
  const imageField = config.inputMode === "first-frame"
    ? {
        frame_images: [{
          type: "image_url",
          image_url: { url: image },
          frame_type: "first_frame",
        }],
      }
    : {
        input_references: [{ type: "image_url", image_url: { url: image } }],
      };

  const submitRes = await fetch(`${OPENROUTER_BASE}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: fullText,
      duration,
      ...imageField,
    }),
  });

  const submitBody = await submitRes.text();
  let job = parseResponseBody(submitBody);
  if (!submitRes.ok) {
    throw new Error(
      `OpenRouter video submit failed: HTTP ${submitRes.status}: ${submitBody.trim() || "(empty response)"}`,
    );
  }
  if (!job.id) {
    throw new Error("OpenRouter video submit returned no job id");
  }

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (job.status === "completed") break;
    if (
      job.status === "failed" ||
      job.status === "cancelled" ||
      job.status === "expired"
    ) {
      throw new Error(
        `OpenRouter video ${job.status}: ${extractError(job, 200)}`,
      );
    }

    await sleep(POLL_INTERVAL_MS);

    const pollUrl = job.polling_url
      ? new URL(job.polling_url, "https://openrouter.ai").toString()
      : `${OPENROUTER_BASE}/videos/${job.id}`;

    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    job = (await pollRes.json().catch(() => ({}))) as VideoJob & ErrorResponse;
    if (!pollRes.ok) {
      throw new Error(
        `OpenRouter video poll failed: ${extractError(job, pollRes.status)}`,
      );
    }
  }

  if (job.status !== "completed") {
    throw new Error(`OpenRouter video did not complete in time (last status: ${job.status})`);
  }

  return resolveDownloadable(job, apiKey);
}

function parseResponseBody(body: string): VideoJob & ErrorResponse {
  try {
    return JSON.parse(body) as VideoJob & ErrorResponse;
  } catch {
    return {} as VideoJob & ErrorResponse;
  }
}

function resolveDownloadable(job: VideoJob, apiKey: string): VideoDownload {
  const authHeaders = { Authorization: `Bearer ${apiKey}` };
  const unsigned = job.unsigned_urls?.[0];
  if (unsigned) {
    // openrouter.ai-hosted unsigned URLs still need the bearer token. Send the key only
    // to openrouter so it can't leak to a third-party CDN.
    return isOpenRouterHost(unsigned)
      ? { url: unsigned, headers: authHeaders }
      : { url: unsigned };
  }
  return {
    url: `${OPENROUTER_BASE}/videos/${job.id}/content?index=0`,
    headers: authHeaders,
  };
}

function isOpenRouterHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "openrouter.ai" || h.endsWith(".openrouter.ai");
  } catch {
    return false;
  }
}

function extractError(payload: ErrorResponse, status: number): string {
  if (typeof payload.error === "string") return payload.error;
  if (payload.error?.message) return payload.error.message;
  return `HTTP ${status}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
