import fs from "node:fs";
import path from "node:path";
import { spawnCli } from "../spawnCli";
import { PUBLIC_DIR, ROOT_DIR, TEMPLATES_DIR } from "../paths";
import type { ProviderContext, ProviderResult } from "./types";

export interface ExistingClip {
  /** Repo-relative path of the original clip. */
  source: string;
  description: string;
  origin: string;
  startSec: number;
  durationSec: number | null;
  /** Share of the frame height cut from the bottom — removes Flow's visible "Veo" watermark (bottom ~2.5%). */
  cropBottomRatio: number;
}

export function loadExistingClips(): Record<string, ExistingClip> {
  return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, "existing_clips.json"), "utf-8"));
}

export function buildClipFfmpegArgs(clip: ExistingClip, src: string, dst: string): string[] {
  const trim = clip.durationSec != null ? ["-t", String(clip.durationSec)] : [];
  const keep = (1 - clip.cropBottomRatio).toFixed(4);
  return [
    "-v", "error", "-y",
    "-ss", String(clip.startSec), ...trim, "-i", src,
    "-an", // the scene's TTS narration is the only audio — Flow clips carry real sound
    "-vf", `crop=iw:trunc(ih*${keep}/2)*2:0:0`,
    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p",
    dst,
  ];
}

/**
 * Reuses an already-made clip from templates/existing_clips.json (no new AI video generation —
 * docs/2단계_설계.md backlog 4): trims, mutes and crops it into public/projects/<id>/videos/.
 * VideoBackground then scales it to cover the frame. Returns null when the id or file is missing.
 */
export function prepareExistingClip(ctx: ProviderContext, clipId: string): ProviderResult | null {
  const clip = loadExistingClips()[clipId];
  if (!clip) {
    ctx.log(`existingClip "${clipId}" is not in templates/existing_clips.json.`);
    return null;
  }
  const src = path.join(ROOT_DIR, clip.source);
  if (!fs.existsSync(src)) {
    ctx.log(`existingClip "${clipId}" source file missing: ${clip.source}`);
    return null;
  }
  const videosDir = path.join(PUBLIC_DIR, "projects", ctx.projectId, "videos");
  fs.mkdirSync(videosDir, { recursive: true });
  const fileName = `${ctx.sceneId}-clip.mp4`;
  const result = spawnCli("ffmpeg", buildClipFfmpegArgs(clip, src, path.join(videosDir, fileName)), { stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed preparing existingClip "${clipId}": ${result.stderr}`);
  }
  return {
    assetPath: `projects/${ctx.projectId}/videos/${fileName}`,
    source: {
      provider: "existing-clip",
      selectedBy: "only-candidate",
      clipId,
      clipPath: clip.source,
      origin: clip.origin,
      trim: { startSec: clip.startSec, durationSec: clip.durationSec },
      cropBottomRatio: clip.cropBottomRatio,
      muted: true,
      generatedAt: new Date().toISOString(),
    },
  };
}
