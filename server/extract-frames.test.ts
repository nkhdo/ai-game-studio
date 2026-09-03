import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ROOT_DIR } from "./files.js";

test("frame extraction contain-fits and transparently pads to the target square", async () => {
  const script = await readFile(path.join(ROOT_DIR, "scripts", "extract-frames.sh"), "utf8");
  assert.match(script, /size="\$\{3:/);
  assert.match(script, /scale=\$size:\$size:force_original_aspect_ratio=decrease:flags=neighbor/);
  assert.match(script, /pad=\$size:\$size:\(ow-iw\)\/2:\(oh-ih\)\/2:color=black@0/);
});
