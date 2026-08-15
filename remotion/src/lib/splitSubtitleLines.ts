export interface SubtitleLine {
  text: string;
  startFrame: number;
  endFrame: number;
}

/**
 * Splits a scene's narration into sentence-level subtitle lines and allocates
 * the scene's total duration across them.
 *
 * The pipeline only measures TTS duration per SCENE (one audio file per scene,
 * see injectDurations.ts) — there is no per-sentence timing data. This is a
 * heuristic, not a transcript-accurate split: duration is allocated by each
 * sentence's character count (whitespace excluded) as a proportion of the
 * total, on the assumption that speech rate is roughly constant. If that
 * proves too imprecise, replace this with real per-sentence timing (e.g.
 * forced alignment) without changing the SubtitleOverlay contract.
 */
export function splitSubtitleLines(text: string, totalDurationInFrames: number): SubtitleLine[] {
  const sentences = text
    .split(/(?<=[.!?。!?\n])\s*/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length === 0) {
    return [];
  }

  if (sentences.length === 1) {
    return [{ text: sentences[0], startFrame: 0, endFrame: totalDurationInFrames }];
  }

  const weights = sentences.map((sentence) => sentence.replace(/\s+/g, "").length || 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const lines: SubtitleLine[] = [];
  let cursor = 0;
  sentences.forEach((sentence, i) => {
    const isLast = i === sentences.length - 1;
    // Last sentence absorbs any rounding remainder so lines always sum to
    // exactly totalDurationInFrames (no gap or overlap at the scene boundary).
    const endFrame = isLast ? totalDurationInFrames : cursor + Math.round((weights[i] / totalWeight) * totalDurationInFrames);
    lines.push({ text: sentence, startFrame: cursor, endFrame });
    cursor = endFrame;
  });

  return lines;
}
