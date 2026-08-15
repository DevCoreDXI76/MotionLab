import path from "node:path";
import type { TtsProvider } from "./ttsProvider";

export interface Scene {
  id: string;
  type: string;
  narration: string;
  subtitleText?: string | null;
  durationMs?: number | null;
  audioPath?: string | null;
  props?: Record<string, unknown>;
}

export interface ScriptData {
  id: string;
  title: string;
  format: "shorts" | "long";
  fps: number;
  width?: number;
  height?: number;
  scenes: Scene[];
}

export async function injectDurations(
  script: ScriptData,
  ttsProvider: TtsProvider,
  audioOutDir: string,
  publicRelativeDir: string,
): Promise<ScriptData> {
  const scenes: Scene[] = [];
  for (const scene of script.scenes) {
    const absPath = path.join(audioOutDir, `${scene.id}.mp3`);
    const { durationMs } = await ttsProvider.generate(scene.narration, absPath);
    scenes.push({
      ...scene,
      durationMs,
      audioPath: `${publicRelativeDir}/${scene.id}.mp3`.replace(/\\/g, "/"),
    });
  }
  return { ...script, scenes };
}
