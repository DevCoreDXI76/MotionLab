export interface TtsResult {
  audioPath: string; // 실제 생성된 오디오 파일의 절대 경로
  durationMs: number;
}

export interface TtsProvider {
  generate(text: string, outPath: string): Promise<TtsResult>;
}
