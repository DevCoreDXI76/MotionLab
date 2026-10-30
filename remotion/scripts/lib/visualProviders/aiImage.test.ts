import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AiImageFailed, buildImagePrompt, candidateSeed, generateAiImage } from "./aiImage";
import type { CandidateJudge, ImageGenerator } from "./aiImage";
import { estimateKleinNeurons, NeuronLedger, QuotaGuardError } from "./neuronLedger";
import { PUBLIC_DIR } from "../paths";

const PROJECT = "__test_aiimage";
const projectDir = path.join(PUBLIC_DIR, "projects", PROJECT);
let tmp: string;
let jpeg: Buffer;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aiimage-test-"));
  const jpegPath = path.join(tmp, "gray.jpg");
  // A real 1072x1920 JPEG so the ffmpeg 1080x1920 fit-up runs for real.
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:s=1072x1920", "-frames:v", "1", jpegPath]);
  jpeg = fs.readFileSync(jpegPath);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

const ctx = { projectId: PROJECT, sceneId: "s1", sceneType: "talkingPoint", log: () => {} };
const generator = (): ImageGenerator & { calls: number[] } => {
  const calls: number[] = [];
  return { model: "fake", calls, generate: async (_p, seed) => (calls.push(seed), jpeg) };
};
const judgeBy = (fn: (seed: number) => { verdict: "pass" | "fail"; score: number }): CandidateJudge => ({
  name: "auto-rule",
  judge: async (cs) => cs.map((c) => ({ ...c, ...fn(c.seed), reasons: [] })),
});

describe("neuron ledger", () => {
  it("estimates klein 1072x1920 like the 008 spike (12 tiles)", () => {
    expect(estimateKleinNeurons(1072, 1920)).toBe(312.6);
  });

  it("sums only today's (UTC) entries and stops at 80% of the free allocation", () => {
    const ledger = new NeuronLedger(path.join(tmp, "ledger-a.jsonl"));
    const base = { model: "m", width: 1, height: 1, project: "p", scene: "s", ok: true };
    ledger.record({ ...base, neuronsEst: 5000 }, new Date("2026-11-01T23:59:00Z"));
    ledger.record({ ...base, neuronsEst: 7800 }, new Date("2026-11-02T00:01:00Z"));
    const now = new Date("2026-11-02T10:00:00Z");
    expect(ledger.usedToday(now)).toBe(7800);
    expect(() => ledger.assertBudget(100, now)).not.toThrow();
    expect(() => ledger.assertBudget(312.6, now)).toThrow(QuotaGuardError);
  });
});

describe("generateAiImage", () => {
  it("appends the fixed style suffix to the scene prompt", () => {
    expect(buildImagePrompt("Hands resting on a keyboard. ", { aiImageSuffix: ", night" })).toBe("Hands resting on a keyboard, night");
  });

  it("uses deterministic, distinct seeds per scene/round/index", () => {
    expect(candidateSeed("008_x", "s1", 0, 0)).toBe(candidateSeed("008_x", "s1", 0, 0));
    const seeds = new Set([0, 1].flatMap((r) => [0, 1].map((i) => candidateSeed("008_x", "s1", r, i))));
    expect(seeds.size).toBe(4);
  });

  it("keeps the best passing candidate at 1080x1920 and records provenance + ledger", async () => {
    const gen = generator();
    const ledger = new NeuronLedger(path.join(tmp, "ledger-b.jsonl"));
    const best = candidateSeed(PROJECT, "s1", 0, 1);
    const result = await generateAiImage(ctx, "hands on a keyboard", {
      generator: gen,
      ledger,
      judge: judgeBy((seed) => ({ verdict: "pass", score: seed === best ? 2 : 1 })),
    });
    expect(result.assetPath).toBe(`projects/${PROJECT}/images/s1.jpg`);
    expect(result.source).toMatchObject({ provider: "cloudflare-workers-ai", selectedBy: "auto-rule", seed: best, neuronsEst: 625.2 });
    expect((result.source.candidates as unknown[]).length).toBe(2);
    expect(ledger.entries().map((e) => e.ok)).toEqual([true, true]);
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(projectDir, "images", "s1.jpg")], { encoding: "utf-8" });
    expect(probe.stdout.trim()).toBe("1080,1920");
  });

  it("tries a second round with new seeds, then gives up with AiImageFailed", async () => {
    const gen = generator();
    const ledger = new NeuronLedger(path.join(tmp, "ledger-c.jsonl"));
    await expect(
      generateAiImage(ctx, "hands", { generator: gen, ledger, judge: judgeBy(() => ({ verdict: "fail", score: 0 })) }),
    ).rejects.toThrow(AiImageFailed);
    expect(new Set(gen.calls).size).toBe(4);
  });

  it("refuses to call the API once the daily guard would be exceeded", async () => {
    const gen = generator();
    const ledger = new NeuronLedger(path.join(tmp, "ledger-d.jsonl"));
    ledger.record({ model: "m", width: 1, height: 1, neuronsEst: 7900, project: "p", scene: "s", ok: true });
    await expect(generateAiImage(ctx, "hands", { generator: gen, ledger })).rejects.toThrow(QuotaGuardError);
    expect(gen.calls).toEqual([]);
  });

  it("logs failed calls to the ledger before rethrowing (they may still be charged)", async () => {
    const ledger = new NeuronLedger(path.join(tmp, "ledger-e.jsonl"));
    const failing: ImageGenerator = { model: "fake", generate: vi.fn(async () => Promise.reject(new Error("HTTP 500"))) };
    await expect(generateAiImage(ctx, "hands", { generator: failing, ledger })).rejects.toThrow("HTTP 500");
    expect(ledger.entries()).toMatchObject([{ ok: false, neuronsEst: 312.6 }]);
  });
});
