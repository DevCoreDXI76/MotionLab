import path from "node:path";
import type { TtsProvider } from "./ttsProvider";
import { applyLexicon } from "./pronunciationLexicon";

export interface Scene {
  id: string;
  type: string;
  narration: string;
  subtitleText?: string | null;
  durationMs?: number | null;
  audioPath?: string | null;
  props?: Record<string, unknown>;
  // Loosely typed here — this module only passes `visual` through untouched
  // (via the spread below); its real shape is CentralVisual.tsx's VisualCue.
  visual?: Record<string, unknown> | null;
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
  lexicon: Record<string, string> = {},
): Promise<ScriptData> {
  const scenes: Scene[] = [];
  for (const scene of script.scenes) {
    const absPath = path.join(audioOutDir, `${scene.id}.mp3`);
    // Lexicon substitution is applied only to the text handed to TTS — `scene`
    // (spread below) still carries the original narration, so script.json's
    // narration/subtitle text is never touched by the substitution.
    const ttsText = applyLexicon(scene.narration, lexicon);
    const { durationMs } = await ttsProvider.generate(ttsText, absPath);
    scenes.push({
      ...scene,
      durationMs,
      audioPath: `${publicRelativeDir}/${scene.id}.mp3`.replace(/\\/g, "/"),
    });
  }
  return { ...script, scenes };
}
