import assert from "node:assert/strict";
import test from "node:test";

test("masks the OpenRouter key and blocks live provider requests", async () => {
  assert.equal(process.env.OPENROUTER_API_KEY, "");
  await assert.rejects(
    fetch("https://openrouter.ai/api/v1/models"),
    /Real OpenRouter requests are disabled in tests/,
  );
});
