import { spawnCli } from "./spawnCli";

export interface ThumbnailScriptInput {
  scenes: Array<{ type: string; durationMs: number; props?: { bullets?: unknown[] } }>;
}

/**
 * Picks a timestamp (ms into the rendered video) to grab a thumbnail frame
 * from, at a point where the scene's content has fully appeared:
 * 1. 85% into the "title" scene (entrance animation done);
 * 2. otherwise 90% into the first scene with bullets (every bullet shown —
 *    008's code-midpoint rule caught a frame with only one bullet);
 * 3. otherwise 40% of total duration.
 */
export function computeThumbnailSeekMs(script: ThumbnailScriptInput): number {
  const at = (index: number, fraction: number) => {
    const elapsed = script.scenes.slice(0, index).reduce((sum, s) => sum + s.durationMs, 0);
    return Math.round(elapsed + script.scenes[index].durationMs * fraction);
  };
  const title = script.scenes.findIndex((s) => s.type === "title");
  if (title >= 0) return at(title, 0.85);
  const bullets = script.scenes.findIndex((s) => (s.props?.bullets?.length ?? 0) > 0);
  if (bullets >= 0) return at(bullets, 0.9);
  const totalMs = script.scenes.reduce((sum, s) => sum + s.durationMs, 0);
  return Math.round(totalMs * 0.4);
}

/**
 * Grabs a single frame from videoPath at seekMs and writes it to outputPath
 * as a PNG, via ffmpeg (already a hard dependency of this pipeline — see
 * lib/audio/loudnorm.ts).
 */
export function extractThumbnail(videoPath: string, seekMs: number, outputPath: string): void {
  const seekSeconds = (seekMs / 1000).toFixed(3);
  const result = spawnCli(
    "ffmpeg",
    ["-y", "-ss", seekSeconds, "-i", videoPath, "-frames:v", "1", "-update", "1", "-q:v", "2", outputPath],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg thumbnail extraction failed for ${videoPath} (exit code ${result.status}).`);
  }
}
