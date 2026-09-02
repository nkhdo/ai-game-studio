import assert from "node:assert/strict";
import test from "node:test";
import { composeSpritesheet } from "../src/lib/spritesheet.js";

test("composes each spritesheet cell at the requested target frame size", async () => {
  class FakeImage {
    width = 320;
    height = 240;
    onload: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  let canvas: { width: number; height: number } | undefined;
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  Object.assign(globalThis, {
    Image: FakeImage,
    document: {
      createElement: () => {
        canvas = {
          width: 0,
          height: 0,
          getContext: () => ({
            imageSmoothingEnabled: true,
            clearRect() {},
            drawImage() {},
          }),
          toDataURL: () => "data:image/png;base64,fake",
        } as unknown as HTMLCanvasElement;
        return canvas;
      },
    },
  });

  try {
    await composeSpritesheet({ frameSrcs: ["a", "b", "c"], cellSize: 64 });
    assert.deepEqual(
      { width: canvas?.width, height: canvas?.height },
      { width: 192, height: 64 },
    );
  } finally {
    Object.assign(globalThis, { Image: previousImage, document: previousDocument });
  }
});
