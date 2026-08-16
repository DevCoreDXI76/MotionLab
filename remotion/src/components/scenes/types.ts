import type { VisualCue } from "../CentralVisual";

export interface SceneProps<T = Record<string, unknown>> {
  narration: string;
  subtitleText: string;
  audioSrc: string;
  /** Scene's total duration in frames — passed through to SubtitleOverlay for line-level timing. */
  durationInFrames: number;
  /** Optional central-visual data — see CentralVisual.tsx. Absent/null falls back to a code-based motion graphic. */
  visual?: VisualCue | null;
  props: T;
}
