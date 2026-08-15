export interface SceneProps<T = Record<string, unknown>> {
  narration: string;
  subtitleText: string;
  audioSrc: string;
  props: T;
}
