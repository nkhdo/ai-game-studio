# AGENTS.md

## Project

SpriteSheetStudio is a Vite + TypeScript client with an Express server for creating 2D game assets. Its workflow acquires a Reference Sprite, generates video, extracts Movement Frames, and creates named Animations from a Frame Sequence.

Use OpenRouter as the only model-provider boundary. Browser code calls server routes; server code calls OpenRouter with raw `fetch`.

## Before changing behavior

- Read `CONTEXT.md` and use its domain language.
- Read relevant decisions in `docs/adr/`.
- For local issues, follow `docs/agents/issue-tracker.md`.
- Treat the code and tests as authoritative for routes, models, defaults, and file layout.

## Invariants

- Projects are autosaved UUID workspaces under `projects/<uuid>/`. Project Labels do not determine storage paths.
- Reference Sprite Acquisition supports generation and PNG/JPEG/WebP upload.
- Replacing a Reference Sprite invalidates all Downstream Artifacts.
- Video generation and local Movement Frame extraction are separate steps.
- Animations own frozen Movement Frames and survive later video or frame generation.
- Generated artifacts stay under gitignored `projects/`.

## Implementation

- Keep the UI lightweight, responsive, accessible, and focused on asset creation.
- Keep loading, success, retry, and error states near their actions. Disable conflicting actions while work runs.
- Organize frontend code around the domain workflow and reusable interaction patterns.
- Keep TypeScript strict, dependencies focused, request/response shapes typed, and functions small.
- Model registries in `server/image.ts` and `server/video.ts` drive server validation and client selectors.

## Security

- Read `OPENROUTER_API_KEY` only on the server. Never expose or log it.
- Send authorization only to OpenRouter hosts.
- Redact `sk-or-...` and `xai-...` tokens from errors and logs.
- Validate request bodies, Project IDs, and filesystem paths.
- Spawn ffmpeg with validated absolute paths and argument arrays.
- Serve generated files only through `/projects/`.

## Verification

```bash
pnpm test
pnpm build
git diff --check
```

Tests must mock OpenRouter. Do not launch the app, open a browser, or make provider requests for agent verification. Live provider checks require the user's explicit request and cost approval.

Never commit `.env`, `projects/`, `frames/`, generated video, or logs. Preserve unrelated user changes.
