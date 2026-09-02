import assert from "node:assert/strict";
import test from "node:test";
import { generateSpriteImage } from "./image.js";
import { emptyManifest, toView } from "./projects.js";

const PNG_SIGNATURE_BASE64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString(
  "base64",
);

test("sends collective style guides through OpenRouter's input_references contract", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  let requestBody: unknown;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
  });

  process.env.OPENROUTER_API_KEY = "test-api-key";
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ data: [{ b64_json: PNG_SIGNATURE_BASE64, media_type: "image/png" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const references = [
    "data:image/png;base64,first",
    "data:image/png;base64,second",
  ];
  await generateSpriteImage("a clockwork raven", "openai/gpt-image-2", {
    geometry: { size: { w: 128, h: 128 }, subjectFillPct: 70 },
    styleGuideDataUrls: references,
  });

  const body = requestBody as {
    prompt: string;
    input_references: Array<{ type: string; image_url: { url: string } }>;
  };
  assert.deepEqual(
    body.input_references.map((reference) => reference.image_url.url),
    references,
  );
  assert.ok(body.input_references.every((reference) => reference.type === "image_url"));
  assert.match(body.prompt, /collectively and without priority/);
  assert.match(body.prompt, /Do not copy their subjects/);
  assert.match(body.prompt, /#00b140/);
});

test("rejects more style guides than the selected model supports before calling OpenRouter", async (t) => {
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  t.after(() => {
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
  });
  process.env.OPENROUTER_API_KEY = "test-api-key";

  await assert.rejects(
    generateSpriteImage("a raven", "x-ai/grok-imagine-image-2.0", {
      styleGuideDataUrls: ["one", "two", "three", "four"],
    }),
    /supports up to 3 Style Guide Images/,
  );
});

test("reports when the draft Style Guide Selection differs from the applied set", () => {
  const manifest = emptyManifest();
  manifest.styleGuideImages = [
    { id: "first", originalFilename: "ink.png", path: "style-guides/first.png" },
    { id: "second", originalFilename: "wash.webp", path: "style-guides/second.png" },
  ];
  manifest.styleGuideSelection = ["first", "second"];
  manifest.appliedStyleGuideSet = ["first"];

  const changedView = toView(manifest);
  assert.equal(changedView.styleGuidesChanged, true);
  assert.deepEqual(
    changedView.styleGuides.map((guide) => guide.originalFilename),
    ["ink.png", "wash.webp"],
  );

  manifest.appliedStyleGuideSet = ["second", "first"];
  assert.equal(toView(manifest).styleGuidesChanged, false);
});
