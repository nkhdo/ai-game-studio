// Keep dotenv/config from hydrating the real key: dotenv does not overwrite an
// environment variable that already exists, including an empty one.
process.env.OPENROUTER_API_KEY = "";

const networkFetch = globalThis.fetch;
globalThis.fetch = (async (input, init) => {
  const rawUrl =
    typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const url = new URL(rawUrl);
  if (url.hostname === "openrouter.ai" || url.hostname.endsWith(".openrouter.ai")) {
    throw new Error("Real OpenRouter requests are disabled in tests");
  }
  return networkFetch(input, init);
}) as typeof fetch;
