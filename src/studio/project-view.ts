import type { ProjectView } from "../lib/api";

function version(url: string | null, key: string): string | null {
  if (!url || url.startsWith("data:")) return url;
  const [withoutHash, hash] = url.split("#", 2);
  const [pathname, query = ""] = withoutHash.split("?", 2);
  const parameters = new URLSearchParams(query);
  parameters.set("v", key);
  return `${pathname}?${parameters.toString()}${hash === undefined ? "" : `#${hash}`}`;
}

export function hydrateProjectAssets(view: ProjectView): ProjectView {
  return {
    ...view,
    spriteUrl: version(view.spriteUrl, view.updatedAt),
    sourceVideoUrl: version(view.sourceVideoUrl, view.updatedAt),
    frames: view.frames.map((url) => version(url, view.framesUpdatedAt)!),
    styleGuides: view.styleGuides.map((guide) => ({
      ...guide,
      url: version(guide.url, view.updatedAt)!,
    })),
    animations: view.animations.map((animation) => ({
      ...animation,
      frameUrls: animation.frameUrls.map((url) => version(url, animation.updatedAt)!),
      spritesheetUrl: version(animation.spritesheetUrl, animation.updatedAt)!,
      previewGifUrl: version(animation.previewGifUrl, animation.updatedAt),
    })),
  };
}
