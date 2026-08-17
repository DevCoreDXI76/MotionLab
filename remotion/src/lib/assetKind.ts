const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];

/** Decides whether a visual.assetPath points at a video (vs. a still image) by its file extension. */
export function isVideoAsset(assetPath: string): boolean {
  const lower = assetPath.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
