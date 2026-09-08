import { spawnCli } from "./spawnCli";

export interface ThumbnailScriptInput {
  scenes: Array<{ type: string; durationMs: number }>;
}

/**
 * Picks a timestamp (ms into the rendered video) to grab a thumbnail frame
 * from: the midpoint of the first "code" scene (the terminal/code visual is
 * the most on-brand, most visually distinct frame in the episode). Falls
 * back to 40% of total duration when there is no "code" scene.
 */
export function computeThumbnailSeekMs(script: ThumbnailScriptInput): number {
  let elapsed = 0;
  for (const scene of script.scenes) {
    if (scene.type === "code") {
      return elapsed + scene.durationMs / 2;
    }
    elapsed += scene.durationMs;
  }
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
