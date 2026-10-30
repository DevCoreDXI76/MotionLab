import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnCli } from "../spawnCli";
import { readSecretFile } from "../secrets";
import { EdgeTtsProvider } from "../ttsProviders/edgeTtsProvider";
import { DAILY_FREE_NEURONS, estimateKleinNeurons, NeuronLedger, STOP_RATIO } from "../visualProviders/neuronLedger";
import { CANDIDATES_PER_ROUND, GEN_HEIGHT, GEN_WIDTH, MAX_ROUNDS } from "../visualProviders/aiImage";
import { loadExistingClips } from "../visualProviders/existingClip";
import { VISUAL_LIMITS } from "../visualIntent";
import { ROOT_DIR, SECRETS_DIR } from "../paths";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  /** Warnings never stop the run (e.g. a reusable clip is missing — that scene just falls back). */
  warnOnly?: boolean;
}

// Worst case per run: every aiImage scene (max 2) burns all rounds × candidates before falling back
// — 2 × 2 × 2 klein calls ≈ 2,501 neurons. Script regeneration and render retries never re-generate images.
export const WORST_CASE_NEURONS = VISUAL_LIMITS.aiImage.max * MAX_ROUNDS * CANDIDATES_PER_ROUND * estimateKleinNeurons(GEN_WIDTH, GEN_HEIGHT);

function commandWorks(command: string, args: string[]): { ok: boolean; detail: string } {
  try {
    const r = spawnCli(command, args, { stdio: "pipe", timeoutMs: 60_000 });
    return { ok: r.status === 0, detail: (r.stdout || r.stderr).trim().split(/\r?\n/)[0]?.slice(0, 80) ?? "" };
  } catch (err) {
    return { ok: false, detail: (err as Error).message.slice(0, 120) };
  }
}

function hasKeys(file: string, keys: string[]): Check {
  try {
    const values = readSecretFile(file);
    const missing = keys.filter((k) => !values[k]);
    return { name: `secrets/${file}`, ok: missing.length === 0, detail: missing.length ? `없는 키: ${missing.join(", ")}` : "있음" };
  } catch (err) {
    return { name: `secrets/${file}`, ok: false, detail: (err as Error).message };
  }
}

/**
 * Everything that would otherwise fail halfway through a run (and waste quota or force a human to
 * pick up the pieces) is checked before the first expensive step (docs/2단계_설계.md §5.1).
 * Includes one real Edge TTS sentence — the 2.0.7 → 403 breakage taught us library version alone
 * says nothing about whether the service still answers.
 */
export async function runPreflight(conceptPath: string, options: { dryRun: boolean }): Promise<Check[]> {
  const checks: Check[] = [];

  const concept = fs.existsSync(conceptPath) ? fs.readFileSync(conceptPath, "utf-8").trim() : "";
  checks.push({ name: "concept.md", ok: concept.length >= 50, detail: concept ? `${concept.length}자` : "없음" });

  const claude = commandWorks("claude", ["--version"]);
  checks.push({ name: "claude CLI", ...claude });
  const ffmpeg = commandWorks("ffmpeg", ["-version"]);
  checks.push({ name: "ffmpeg", ...ffmpeg });
  const cv2 = commandWorks("py", ["-c", "import cv2; print(cv2.__version__)"]);
  checks.push({ name: "OpenCV(얼굴 검사)", ...cv2 });

  checks.push(hasKeys("cloudflare_ai.txt", ["ACCOUNT_ID", "API_TOKEN"]));
  checks.push(hasKeys("pexels_api_key.txt", ["PEXELS_API_KEY"]));

  const used = new NeuronLedger().usedToday();
  const budget = DAILY_FREE_NEURONS * STOP_RATIO;
  checks.push({
    name: "Cloudflare 오늘 할당",
    ok: used + WORST_CASE_NEURONS <= budget,
    detail: `사용 ~${used} + 최악 ~${WORST_CASE_NEURONS} / 상한 ${budget} (리셋 09:00 KST)`,
  });

  for (const [id, clip] of Object.entries(loadExistingClips())) {
    const exists = fs.existsSync(path.join(ROOT_DIR, clip.source));
    checks.push({ name: `기존 클립 ${id}`, ok: exists, detail: exists ? "있음" : "없음 → 그 씬은 Pexels로 폴백", warnOnly: true });
  }

  const ttsDir = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-tts-"));
  const tts = new EdgeTtsProvider();
  try {
    const { durationMs } = await tts.generate("파이프라인 사전 점검입니다.", path.join(ttsDir, "check.mp3"));
    checks.push({ name: "Edge TTS 1문장", ok: durationMs > 0, detail: `${durationMs}ms` });
  } catch (err) {
    checks.push({ name: "Edge TTS 1문장", ok: false, detail: (err as Error).message.slice(0, 120) });
  } finally {
    tts.close();
    fs.rmSync(ttsDir, { recursive: true, force: true });
  }

  if (!options.dryRun) {
    const secretsOk = ["youtube_client_secret.json", "youtube_token.json"].every((f) => fs.existsSync(path.join(SECRETS_DIR, f)));
    const token = secretsOk ? commandWorks("py", [path.join(ROOT_DIR, "scripts", "youtube_token_check.py")]) : { ok: false, detail: "secrets/youtube_*.json 없음" };
    checks.push({ name: "YouTube 인증", ok: token.ok, detail: token.ok ? "ok" : `${token.detail} — 실행 전에 py scripts/youtube_upload.py 로그인 필요` });
  }

  return checks;
}
