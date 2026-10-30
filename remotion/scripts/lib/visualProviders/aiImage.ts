import fs from "node:fs";
import path from "node:path";
import { spawnCli } from "../spawnCli";
import { PUBLIC_DIR, TEMPLATES_DIR } from "../paths";
import { maskSecrets, readSecretFile } from "../secrets";
import { estimateKleinNeurons, NeuronLedger } from "./neuronLedger";
import { PixelRuleJudge } from "../candidateJudge";
import type { ProviderContext, ProviderResult } from "./types";

export const KLEIN_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
// klein only takes multiples of 16 — 1080 comes back as 1072 (008 spike), so ask for that and fix up locally.
export const GEN_WIDTH = 1072;
export const GEN_HEIGHT = 1920;
const REQUEST_TIMEOUT_MS = 60_000; // covers DNS too (the spike's urllib timeout didn't, and hung 10+ min)

export interface ImageGenerator {
  readonly model: string;
  generate(prompt: string, seed: number, width: number, height: number): Promise<Buffer>;
}

export class CloudflareKleinGenerator implements ImageGenerator {
  readonly model = KLEIN_MODEL;

  async generate(prompt: string, seed: number, width: number, height: number): Promise<Buffer> {
    const creds = readSecretFile("cloudflare_ai.txt");
    const form = new FormData();
    form.set("prompt", prompt);
    form.set("width", String(width));
    form.set("height", String(height));
    form.set("seed", String(seed));
    const url = `https://api.cloudflare.com/client/v4/accounts/${creds.ACCOUNT_ID}/ai/run/${this.model}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.API_TOKEN}` },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Cloudflare Workers AI HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      const image = (JSON.parse(text) as { result?: { image?: string } }).result?.image;
      if (!image) {
        throw new Error(`Cloudflare Workers AI response had no image: ${text.slice(0, 300)}`);
      }
      return Buffer.from(image, "base64");
    } catch (err) {
      throw new Error(maskSecrets(err instanceof Error ? err.message : String(err)));
    }
  }
}

export interface Candidate {
  file: string; // public/-relative
  absPath: string;
  seed: number;
  round: number;
}

export interface JudgedCandidate extends Candidate {
  verdict: "pass" | "fail";
  score: number;
  reasons: string[];
  /** Raw judge output, kept in visual.source for later audit. */
  findings?: unknown;
}

/** Picks which generated candidates are usable (backlog 3) — see lib/candidateJudge.ts. */
export interface CandidateJudge {
  readonly name: "auto-vision" | "auto-rule";
  judge(candidates: Candidate[], prompt: string): Promise<JudgedCandidate[]>;
}

interface VisualStyle {
  aiImageSuffix: string;
}

export function loadVisualStyle(): VisualStyle {
  return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, "visual_style.json"), "utf-8"));
}

/** Style is fixed by code, not left to the script writer, so tone stays consistent across scenes and episodes. */
export function buildImagePrompt(scenePrompt: string, style: VisualStyle = loadVisualStyle()): string {
  return scenePrompt.trim().replace(/[.,\s]+$/, "") + style.aiImageSuffix;
}

/** Deterministic per project/scene/round/index so a re-run reproduces the same candidates. */
export function candidateSeed(projectId: string, sceneId: string, round: number, index: number): number {
  let hash = 0;
  for (const ch of `${projectId}/${sceneId}`) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return (hash % 1_000_000_000) + round * 100 + index;
}

/** 1072x1920 → 1080x1920: scale width up (~0.7%) and centre-crop the height back to 1920. */
export function fitTo1080x1920(src: string, dst: string): void {
  const result = spawnCli(
    "ffmpeg",
    ["-v", "error", "-y", "-i", src, "-vf", "scale=1080:-2,crop=1080:1920", "-q:v", "2", dst],
    { stdio: "pipe" },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg resize failed for ${src}: ${result.stderr}`);
  }
}

export class AiImageFailed extends Error {}

export interface AiImageOptions {
  generator?: ImageGenerator;
  judge?: CandidateJudge;
  ledger?: NeuronLedger;
  candidatesPerRound?: number;
  maxRounds?: number;
}

/**
 * Generates `candidatesPerRound` klein images per round, asks the judge which pass, and keeps the
 * best. All rejected → next round with new seeds. Throws AiImageFailed (all rounds rejected) or
 * QuotaGuardError / a network error — the caller turns any of those into a Pexels fallback.
 */
export async function generateAiImage(
  ctx: ProviderContext,
  scenePrompt: string,
  options: AiImageOptions = {},
): Promise<ProviderResult> {
  const generator = options.generator ?? new CloudflareKleinGenerator();
  const judge = options.judge ?? new PixelRuleJudge();
  const ledger = options.ledger ?? new NeuronLedger();
  const perRound = options.candidatesPerRound ?? 2;
  const maxRounds = options.maxRounds ?? 2;
  const prompt = buildImagePrompt(scenePrompt);

  const imagesDir = path.join(PUBLIC_DIR, "projects", ctx.projectId, "images");
  const candidatesDir = path.join(imagesDir, "candidates");
  fs.mkdirSync(candidatesDir, { recursive: true });

  const history: JudgedCandidate[] = [];
  let neuronsUsed = 0;
  for (let round = 0; round < maxRounds; round++) {
    const candidates: Candidate[] = [];
    for (let i = 0; i < perRound; i++) {
      const seed = candidateSeed(ctx.projectId, ctx.sceneId, round, i);
      const est = estimateKleinNeurons(GEN_WIDTH, GEN_HEIGHT);
      ledger.assertBudget(est);
      const base = `${ctx.sceneId}-r${round}c${i}`;
      let image: Buffer;
      try {
        image = await generator.generate(prompt, seed, GEN_WIDTH, GEN_HEIGHT);
      } catch (err) {
        ledger.record({ model: generator.model, width: GEN_WIDTH, height: GEN_HEIGHT, neuronsEst: est, project: ctx.projectId, scene: ctx.sceneId, ok: false });
        throw err;
      }
      ledger.record({ model: generator.model, width: GEN_WIDTH, height: GEN_HEIGHT, neuronsEst: est, project: ctx.projectId, scene: ctx.sceneId, ok: true });
      neuronsUsed += est;
      const rawPath = path.join(candidatesDir, `${base}.raw.jpg`);
      const absPath = path.join(candidatesDir, `${base}.jpg`);
      fs.writeFileSync(rawPath, image);
      fitTo1080x1920(rawPath, absPath);
      fs.rmSync(rawPath);
      candidates.push({ file: `projects/${ctx.projectId}/images/candidates/${base}.jpg`, absPath, seed, round });
      ctx.log(`aiImage ${base}: seed ${seed}, ~${est} neurons (today ~${ledger.usedToday()})`);
    }

    const judged = await judge.judge(candidates, prompt);
    history.push(...judged);
    const usable = judged.filter((c) => c.verdict !== "fail").sort((a, b) => b.score - a.score);
    if (usable.length > 0) {
      const chosen = usable[0];
      const fileName = `${ctx.sceneId}.jpg`;
      fs.copyFileSync(chosen.absPath, path.join(imagesDir, fileName));
      return {
        assetPath: `projects/${ctx.projectId}/images/${fileName}`,
        source: {
          provider: "cloudflare-workers-ai",
          selectedBy: judge.name,
          model: generator.model,
          prompt,
          seed: chosen.seed,
          width: 1080,
          height: 1920,
          generatedSize: [GEN_WIDTH, GEN_HEIGHT],
          candidates: history.map(({ file, seed, round, verdict, score, reasons, findings }) => ({ file, seed, round, verdict, score, reasons, findings })),
          neuronsEst: Math.round(neuronsUsed * 10) / 10,
          generatedAt: new Date().toISOString(),
        },
      };
    }
    ctx.log(`aiImage ${ctx.sceneId}: round ${round} — all ${judged.length} candidates rejected.`);
  }
  throw new AiImageFailed(`all ${history.length} candidates rejected after ${maxRounds} round(s)`);
}
