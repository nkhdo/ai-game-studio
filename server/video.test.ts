import assert from "node:assert/strict";
import test from "node:test";
import {
  generateSpriteMotionVideo,
  normalizeVideoInput,
  defaultDurationFor,
  isVideoModelId,
  VIDEO_MODELS,
} from "./video.js";
import sharp from "sharp";

test("registers the Seedance 2.0 Mini and Seedance 2.5 video models", () => {
  assert.deepEqual(
    VIDEO_MODELS.filter(({ id }) =>
      ["bytedance/seedance-2.0-mini", "bytedance/seedance-2.5"].includes(id),
    ),
    [
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
    ],
  );
});

test("records known input constraints without inventing unknown ones", () => {
  const constrainedWidths: Record<string, number> = {
    "x-ai/grok-imagine-video": 300,
    "bytedance/seedance-2.0-mini": 300,
    "bytedance/seedance-2.5": 300,
  };

  for (const model of VIDEO_MODELS) {
    assert.equal(model.minInputWidth, constrainedWidths[model.id] ?? null);
    assert.equal(model.minInputHeight, null);
  }

  const grok = VIDEO_MODELS.find(({ id }) => id === "x-ai/grok-imagine-video")!;
  assert.match(grok.constraintNote ?? "", /observed provider rejection/i);
});

test("enlarges an undersized video input by the smallest integer multiple", async () => {
  const source = await sharp({
    create: { width: 192, height: 192, channels: 3, background: "#00b140" },
  }).png().toBuffer();

  const normalized = await normalizeVideoInput(source, "x-ai/grok-imagine-video");
  assert.deepEqual(normalized.sourceDimensions, { w: 192, h: 192 });
  assert.deepEqual(normalized.inputDimensions, { w: 384, h: 384 });
  const normalizedBuffer = Buffer.from(normalized.dataUrl.split(",")[1], "base64");
  assert.equal((await sharp(normalizedBuffer).metadata()).width, 384);
});

test("submits the authoritative image as an exact first frame", async (t) => {
  process.env.OPENROUTER_API_KEY = "test-key";
  let requestBody: Record<string, unknown> | undefined;
  t.mock.method(globalThis, "fetch", async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: "job-1",
      status: "completed",
      unsigned_urls: ["https://cdn.example/video.mp4"],
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  await generateSpriteMotionVideo("data:image/png;base64,abc", "walk", 2, "x-ai/grok-imagine-video");
  assert.equal(requestBody?.input_references, undefined);
  assert.deepEqual(requestBody?.frame_images, [{
    type: "image_url",
    image_url: { url: "data:image/png;base64,abc" },
    frame_type: "first_frame",
  }]);
});

test("appends the palette directive only when Palette Lock is on", async (t) => {
  process.env.OPENROUTER_API_KEY = "test-key";
  const prompts: string[] = [];
  t.mock.method(globalThis, "fetch", async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const body = JSON.parse(String(init?.body)) as { prompt: string };
    prompts.push(body.prompt);
    return new Response(JSON.stringify({
      id: "job-1",
      status: "completed",
      unsigned_urls: ["https://cdn.example/video.mp4"],
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  await generateSpriteMotionVideo("data:image/png;base64,abc", "walk", 2, "x-ai/grok-imagine-video", true);
  await generateSpriteMotionVideo("data:image/png;base64,abc", "walk", 2, "x-ai/grok-imagine-video", false);
  assert.match(prompts[0], /only the colors present in the provided reference image/);
  assert.doesNotMatch(prompts[1], /only the colors present in the provided reference image/);
  assert.match(prompts[1], /chroma green background/);
});

test("preserves the raw provider error payload", async (t) => {
  process.env.OPENROUTER_API_KEY = "test-key";
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    error: { code: "InvalidParameter", message: "too small", param: "image_url" },
  }), { status: 400, headers: { "content-type": "application/json" } }));

  await assert.rejects(
    generateSpriteMotionVideo("data:image/png;base64,abc", "walk", 2, "x-ai/grok-imagine-video"),
    /\{"error":\{"code":"InvalidParameter","message":"too small","param":"image_url"\}\}/,
  );
});

test("accepts the new Seedance ids and resolves their default durations", () => {
  for (const id of ["bytedance/seedance-2.0-mini", "bytedance/seedance-2.5"] as const) {
    assert.equal(isVideoModelId(id), true);
    assert.equal(defaultDurationFor(id), 4);
  }
});
