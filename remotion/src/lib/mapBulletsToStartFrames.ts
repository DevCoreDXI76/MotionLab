import type { SubtitleLine } from "./splitSubtitleLines";

/**
 * Maps each bullet in a TalkingPointScene to the frame it should start
 * entering, based on when the matching narration sentence begins (from
 * splitSubtitleLines) instead of a fixed cadence — so bullets read as
 * "appearing as the narration gets to them" rather than bunching up in the
 * scene's first second.
 *
 * There's no schema guarantee that bullet count matches sentence count, so:
 * - fewer bullets than sentences: bullet i maps to sentence i.
 * - more bullets than sentences: bullets beyond the last sentence clamp to
 *   the last sentence's start frame (documented limitation — they appear
 *   together at that point rather than being invented new timing).
 * - no sentence lines at all (e.g. punctuation-free narration): falls back
 *   to a fixed cadence of `minDelayFrames` per bullet.
 *
 * `minDelayFrames` doubles as the floor for every mapped frame — a sentence
 * starting at frame 0 would otherwise fire at the same instant as the
 * heading's own entrance animation.
 */
export function mapBulletsToStartFrames(
  bullets: string[],
  lines: SubtitleLine[],
  minDelayFrames: number,
): number[] {
  if (lines.length === 0) {
    return bullets.map((_, i) => (i + 1) * minDelayFrames);
  }

  return bullets.map((_, i) => {
    const line = lines[Math.min(i, lines.length - 1)];
    return Math.max(line.startFrame, minDelayFrames);
  });
}
