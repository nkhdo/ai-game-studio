# Video input-image constraints

Research date: 2026-09-03

## Question

What explicit input-image dimension constraints are documented for the video
models configured in `server/video.ts`?

This note treats output resolution as a separate property. It does not infer an
input minimum from a model's supported output resolutions or aspect ratios.

## Findings

| OpenRouter model | Explicit input-image minimum | Other explicit input-image constraints | Confidence / registry consequence |
| --- | --- | --- | --- |
| `x-ai/grok-imagine-video` | OpenRouter's public model and video API documentation does not state a minimum. The project has separately observed an upstream rejection saying width must be at least 300 px; that observation is not a documentation-derived claim. | OpenRouter lists supported *output* aspect ratios and resolutions, but no input-image maximum, file-size limit, or input aspect-ratio range on the model page. | Keep the existing observed `minInputWidth: 300`; do not add a documented height constraint. |
| `minimax/hailuo-3` | Width **and** height are each in the inclusive range **256–5760 px**. | Input image aspect ratio (width/height) must be **0.4–2.5**; each image must be no larger than **30 MB**. | Set `minInputWidth: 256` and `minInputHeight: 256`. |
| `bytedance/seedance-2.0` | Width **and** height are each in the inclusive range **300–6000 px**. | Input image aspect ratio (width/height) must be **0.4–2.5**; each image must be under **30 MB**. | Set `minInputWidth: 300` and `minInputHeight: 300`. The current normalization satisfies the aspect-ratio rule for square sprites. |
| `bytedance/seedance-2.0-mini` | Width **and** height are each in the inclusive range **300–6000 px**. | Input image aspect ratio (width/height) must be **0.4–2.5**; each image must be under **30 MB**. | Set `minInputWidth: 300` and `minInputHeight: 300`. |
| `bytedance/seedance-2.5` | Width **and** height are each in the inclusive range **300–6000 px**. | Input image aspect ratio (width/height) must be **0.4–2.5**; each image must be under **30 MB**. | Set `minInputWidth: 300` and `minInputHeight: 300`. |

## Primary-source evidence

### ByteDance Seedance 2.x

BytePlus's official Enhanced/Basic Video Generation documentation identifies
the exact provider model IDs corresponding to Seedance 2.0, 2.0 Mini, and 2.5,
and its capability table includes all three as image-to-video models. In the
shared Seedance 2.x input requirements it specifies:

- image aspect ratio (width/height): `[0.4, 2.5]`;
- width and height: `[300, 6000]` pixels; and
- each image: less than 30 MB.

Source: [BytePlus — Enhanced/basic video generation](https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced) (see “Supported models,” “Model capabilities,” and “Input format: image”).

OpenRouter's model pages confirm the configured slugs represent the matching
ByteDance models and support image-to-video/frame-image inputs, but they do not
publish an input-pixel minimum:

- [OpenRouter — Seedance 2.0](https://openrouter.ai/bytedance/seedance-2.0)
- [OpenRouter — Seedance 2.0 Mini](https://openrouter.ai/bytedance/seedance-2.0-mini)
- [OpenRouter — Seedance 2.5](https://openrouter.ai/bytedance/seedance-2.5)

### MiniMax H3

MiniMax's official H3 V2 video-generation reference explicitly identifies
`MiniMax-H3` as a supported model and applies these `image_url` limits: width
and height `[256, 5760]` px, aspect ratio `[0.4, 2.5]`, and single-file size no
larger than 30 MB:
[MiniMax — Create Video Generation Task](https://platform.minimax.io/docs/api-reference/video-generation-v2-create).

OpenRouter's model page confirms that its configured H3 slug refers to this
MiniMax H3 model and supports image inputs:
[OpenRouter — MiniMax H3](https://openrouter.ai/minimax/hailuo-03-20260730).

### Grok Imagine Video

OpenRouter confirms image-to-video support plus output resolutions and aspect
ratios, but does not state a minimum input-image width or height:
[OpenRouter — Grok Imagine Video](https://openrouter.ai/x-ai/grok-imagine-video).
The generic create-video schema likewise defines frame images without numeric
input-image bounds:
[OpenRouter — Submit a video generation request](https://openrouter.ai/docs/api/api-reference/video-generation/create-videos).

## Implementation recommendation

All four currently empty registry entries can be filled from explicit published
documentation: use a 256 px minimum for both H3 dimensions and a 300 px minimum
for both dimensions of each Seedance model. Keep Grok's existing width-only
value identified as an observed provider constraint, not an official documented
constraint.

The documented maximum, aspect-ratio, and file-size constraints are real but
are outside the current registry's minimum-only schema. If arbitrary non-square
or large user uploads become part of this path, validate those constraints
before submission rather than silently treating minimum resizing as sufficient.
