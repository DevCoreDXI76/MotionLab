import fs from "node:fs";
import path from "node:path";
import { spawnCli } from "../spawnCli";

/**
 * Verifies ffmpeg is reachable on PATH before rendering starts, so a missing
 * install fails fast with a clear message instead of after the (slow)
 * Remotion render, inside normalizeLoudness().
 */
export function assertFfmpegAvailable(): void {
  let result;
  try {
    result = spawnCli("ffmpeg", ["-version"], { stdio: "pipe" });
  } catch (err) {
    throw new Error(
      `ffmpeg not found on PATH. Install it (e.g. "winget install ffmpeg") before rendering.\n${(err as Error).message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error("ffmpeg not found on PATH. Install it (e.g. \"winget install ffmpeg\") before rendering.");
  }
}

/**
 * Normalizes the rendered video's audio loudness to -14 LUFS (YouTube's
 * approximate target) in place, using a single-pass ffmpeg loudnorm filter.
 * Single-pass is an approximation (±0.5 LU) rather than measure-then-apply
 * two-pass accuracy — acceptable for upload purposes; revisit if precision
 * becomes a problem.
 */
export function normalizeLoudness(videoPath: string): void {
  const ext = path.extname(videoPath);
  const tmpPath = path.join(path.dirname(videoPath), `${path.basename(videoPath, ext)}.loudnorm-tmp${ext}`);

  const result = spawnCli(
    "ffmpeg",
    ["-y", "-i", videoPath, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:v", "copy", "-ar", "48000", tmpPath],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg loudnorm failed for ${videoPath} (exit code ${result.status}).`);
  }

  fs.renameSync(tmpPath, videoPath);
}
