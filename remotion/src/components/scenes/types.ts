export interface SceneProps<T = Record<string, unknown>> {
  narration: string;
  subtitleText: string;
  audioSrc: string;
  /** Scene's total duration in frames — passed through to SubtitleOverlay for line-level timing. */
  durationInFrames: number;
  props: T;
}
