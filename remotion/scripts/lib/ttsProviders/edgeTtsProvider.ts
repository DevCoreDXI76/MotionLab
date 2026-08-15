import fs from "node:fs/promises";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { parseFile } from "music-metadata";
import type { TtsProvider, TtsResult } from "../ttsProvider";

const DEFAULT_VOICE = process.env.MOTIONLAB_TTS_VOICE ?? "ko-KR-SunHiNeural";

export class EdgeTtsProvider implements TtsProvider {
  private client: MsEdgeTTS | null = null;

  private async getClient(): Promise<MsEdgeTTS> {
    if (!this.client) {
      this.client = new MsEdgeTTS();
      await this.client.setMetadata(DEFAULT_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    }
    return this.client;
  }

  async generate(text: string, outPath: string): Promise<TtsResult> {
    const client = await this.getClient();
    const outDir = path.dirname(outPath);
    await fs.mkdir(outDir, { recursive: true });

    const { audioFilePath } = await client.toFile(outDir, text);
    await fs.rename(audioFilePath, outPath);

    const meta = await parseFile(outPath);
    const durationMs = Math.round((meta.format.duration ?? 0) * 1000);
    if (!durationMs) {
      throw new Error(`Failed to measure duration for generated audio: ${outPath}`);
    }

    return { audioPath: outPath, durationMs };
  }

  close(): void {
    this.client?.close();
    this.client = null;
  }
}
