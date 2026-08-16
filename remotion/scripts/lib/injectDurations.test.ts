import { describe, expect, it } from "vitest";
import { injectDurations, type ScriptData } from "./injectDurations";
import type { TtsProvider, TtsResult } from "./ttsProvider";

class FakeTtsProvider implements TtsProvider {
  calls: Array<{ text: string; outPath: string }> = [];
  async generate(text: string, outPath: string): Promise<TtsResult> {
    this.calls.push({ text, outPath });
    return { audioPath: outPath, durationMs: text.length * 100 };
  }
}

const script: ScriptData = {
  id: "001_sample",
  title: "샘플",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "안녕하세요" },
    { id: "s2", type: "outro", narration: "다음편에 만나요" },
  ],
};

describe("injectDurations", () => {
  it("fills durationMs and audioPath for every scene using the given provider", async () => {
    const provider = new FakeTtsProvider();
    const result = await injectDurations(script, provider, "/tmp/audio", "projects/001_sample/audio");

    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0].durationMs).toBe("안녕하세요".length * 100);
    expect(result.scenes[0].audioPath).toBe("projects/001_sample/audio/s1.mp3");
    expect(provider.calls[0].outPath).toContain("s1.mp3");
  });

  it("does not mutate the original script object", async () => {
    const provider = new FakeTtsProvider();
    await injectDurations(script, provider, "/tmp/audio", "projects/001_sample/audio");
    expect(script.scenes[0].durationMs).toBeUndefined();
  });

  it("sends lexicon-substituted text to TTS but keeps the original narration in the result", async () => {
    const lexiconScript: ScriptData = {
      ...script,
      scenes: [{ id: "s1", type: "title", narration: "이건 JSON 파일입니다" }],
    };
    const provider = new FakeTtsProvider();
    const result = await injectDurations(lexiconScript, provider, "/tmp/audio", "projects/001_sample/audio", {
      JSON: "제이슨",
    });

    expect(provider.calls[0].text).toBe("이건 제이슨 파일입니다");
    expect(result.scenes[0].narration).toBe("이건 JSON 파일입니다");
  });

  it("defaults to no substitution when no lexicon is given", async () => {
    const provider = new FakeTtsProvider();
    await injectDurations(script, provider, "/tmp/audio", "projects/001_sample/audio");
    expect(provider.calls[0].text).toBe("안녕하세요");
  });
});
