import fs from "node:fs";
import path from "node:path";
import { ClaudeCliRunner } from "../claudeCliRunner";
import { generateScript, ScriptValidationError } from "../claudeScriptGenerator";
import { buildGuardedCast, resolveCastCommands } from "../castCommands";
import { injectDurations } from "../injectDurations";
import type { ScriptData } from "../injectDurations";
import { loadLexicon } from "../pronunciationLexicon";
import { validateScript } from "../scriptSchema";
import { maskSecrets } from "../secrets";
import { spawnCli } from "../spawnCli";
import { EdgeTtsProvider } from "../ttsProviders/edgeTtsProvider";
import { assessAiVisualFloor, validateVisualIntent } from "../visualIntent";
import { loadExistingClips } from "../visualProviders/existingClip";
import { generateVisuals } from "../visualProviders/generateVisuals";
import type { FallbackEvent } from "../visualProviders/resolveVisual";
import { NeuronLedger } from "../visualProviders/neuronLedger";
import { PROJECTS_DIR, PUBLIC_DIR, REMOTION_DIR, ROOT_DIR } from "../paths";
import { runPreflight } from "./preflight";
import type { Check } from "./preflight";
import { demoteDiagramScenes, demoteOverCapVisuals, normalizeGeneratedScript } from "./normalize";
import { appendRunLog, decideVerdict, STEP_ORDER } from "./report";
import type { AutoFallback, Intervention, RunReport, StepName, StepRecord } from "./report";

// docs/2단계_설계.md §5.2 retry budget.
export const SCRIPT_CLI_ATTEMPTS = 3;
export const SCRIPT_VALIDATION_RETRIES = 2;
export const SCRIPT_CLI_RETRY_DELAY_MS = 30_000;
export const TTS_RETRY_DELAYS_MS = [5_000, 15_000];

type Script = ScriptData & { scenes: Array<ScriptData["scenes"][number] & { props?: Record<string, unknown> }> };

export interface PipelineDeps {
  preflight: (conceptPath: string, options: { dryRun: boolean }) => Promise<Check[]>;
  /** One `claude -p` call; throws ScriptValidationError when the output fails the schema. */
  writeScript: (concept: string, projectId: string, feedback: string[]) => Record<string, unknown>;
  narrate: (projectId: string, script: Script) => Promise<Script>;
  visuals: (projectId: string) => Promise<FallbackEvent[]>;
  /** Exit status of render.ts (render + loudnorm + metadata + thumbnail). */
  render: (projectId: string) => number;
  /** Exit status of youtube_upload.py — always private (D5). */
  upload: (projectId: string) => number;
  castCommands: typeof resolveCastCommands;
  runCast: typeof buildGuardedCast;
  neuronsToday: () => number;
  sleep: (ms: number) => Promise<void>;
}

/** The upload command line: never --privacy (stays private) and never --force (D5). */
export function buildUploadArgs(projectId: string): string[] {
  return [path.join(ROOT_DIR, "scripts", "youtube_upload.py"), "--project", `projects/${projectId}`];
}

export const defaultDeps: PipelineDeps = {
  preflight: runPreflight,
  writeScript: (concept, projectId, feedback) =>
    generateScript(new ClaudeCliRunner(), "아래 concept.md 참조", "shorts", projectId, { concept, feedback }),
  narrate: async (projectId, script) => {
    const provider = new EdgeTtsProvider();
    try {
      const audioDir = path.join(PUBLIC_DIR, "projects", projectId, "audio");
      return (await injectDurations(script, provider, audioDir, `projects/${projectId}/audio`, loadLexicon())) as Script;
    } finally {
      provider.close();
    }
  },
  visuals: (projectId) => generateVisuals(projectId),
  render: (projectId) => spawnCli("npx", ["tsx", "scripts/render.ts", projectId], { cwd: REMOTION_DIR, stdio: "inherit" }).status ?? 1,
  upload: (projectId) => spawnCli("py", buildUploadArgs(projectId), { cwd: ROOT_DIR, stdio: "inherit" }).status ?? 1,
  castCommands: resolveCastCommands,
  runCast: buildGuardedCast,
  neuronsToday: () => new NeuronLedger().usedToday(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

class StepFailed extends Error {}

export interface PipelineOptions {
  dryRun: boolean;
  projectsDir?: string;
  log?: (message: string) => void;
}

/**
 * concept.md → script → cast → TTS → visuals → render(+metadata/thumbnail) → private upload, with
 * the retry/fallback rules of docs/2단계_설계.md §5.2. Every run — successful or not — ends with a
 * report appended to projects/<id>/log.md, separating automatic fallbacks from human interventions,
 * and an AI-visual floor verdict (§5.2.1).
 */
export async function runPipeline(projectId: string, options: PipelineOptions, deps: PipelineDeps = defaultDeps): Promise<RunReport> {
  const log = options.log ?? ((m: string) => console.log(m));
  const projectDir = path.join(options.projectsDir ?? PROJECTS_DIR, projectId);
  const scriptPath = path.join(projectDir, "script.json");
  const statePath = path.join(projectDir, "pipeline_state.json");
  const conceptPath = path.join(projectDir, "concept.md");
  const readScript = () => JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as Script;
  const writeScript = (s: Script) => fs.writeFileSync(scriptPath, JSON.stringify(s, null, 2));

  const steps: StepRecord[] = STEP_ORDER.map((name) => ({ name, status: "skipped", attempts: 0, seconds: 0, notes: [] }));
  const fallbacks: AutoFallback[] = [];
  const interventions: Intervention[] = [];
  const startedAt = new Date().toISOString();
  const neuronsAtStart = deps.neuronsToday();
  let floor: RunReport["floor"] = null;
  let uploadUrl: string | null = null;

  if (fs.existsSync(statePath)) {
    // Somebody decided to run this episode again — by the completion criterion that is a human call.
    interventions.push({ step: "run", reason: "이전 실행 기록이 있는 편을 다시 실행함(재실행 판단은 사람 개입)" });
  }

  const step = async (name: StepName, body: (rec: StepRecord) => Promise<void>) => {
    const rec = steps.find((s) => s.name === name)!;
    const t0 = Date.now();
    log(`[${name}] 시작`);
    try {
      await body(rec);
      rec.status = "ok";
    } catch (err) {
      rec.status = "failed";
      const reason = maskSecrets(err instanceof Error ? err.message : String(err)).slice(0, 500);
      rec.notes.push(reason);
      interventions.push({ step: name, reason: `자동으로 해결하지 못하고 중단: ${reason.split("\n")[0]}` });
      throw new StepFailed(reason);
    } finally {
      rec.seconds = Math.round((Date.now() - t0) / 1000);
      log(`[${name}] ${rec.status} (${rec.seconds}초)`);
    }
  };

  let report: RunReport | null = null;
  try {
    await step("preflight", async (rec) => {
      rec.attempts = 1;
      const checks = await deps.preflight(conceptPath, { dryRun: options.dryRun });
      for (const c of checks) {
        if (!c.ok && c.warnOnly) rec.notes.push(`주의: ${c.name} — ${c.detail}`);
      }
      const failed = checks.filter((c) => !c.ok && !c.warnOnly);
      if (failed.length > 0) throw new Error(failed.map((c) => `${c.name}: ${c.detail}`).join("; "));
      rec.notes.push(`${checks.length}개 점검 통과`);
    });

    await step("script", async (rec) => {
      const concept = fs.readFileSync(conceptPath, "utf-8");
      const clipIds = Object.keys(loadExistingClips());
      let feedback: string[] = [];
      let cliFailures = 0;
      let validationRetries = 0;
      for (;;) {
        rec.attempts++;
        let raw: Record<string, unknown>;
        try {
          raw = deps.writeScript(concept, projectId, feedback);
        } catch (err) {
          if (err instanceof ScriptValidationError) {
            if (validationRetries++ >= SCRIPT_VALIDATION_RETRIES) throw err;
            feedback = err.errors;
            fallbacks.push({ step: "script", detail: `스키마 검증 실패 → 오류를 붙여 재생성 (${err.errors.length}건)` });
            continue;
          }
          if (++cliFailures >= SCRIPT_CLI_ATTEMPTS) throw err;
          fallbacks.push({ step: "script", detail: `claude -p 실패 → 30초 후 재시도: ${(err as Error).message.slice(0, 120)}` });
          await deps.sleep(SCRIPT_CLI_RETRY_DELAY_MS);
          continue;
        }
        const { script, demoted } = demoteOverCapVisuals(normalizeGeneratedScript(raw as unknown as Script, projectId));
        for (const d of demoted) fallbacks.push({ step: "script", detail: `상한 초과 강등 ${d}` });
        const errors = [...validateScript(script).errors, ...validateVisualIntent(script, clipIds)];
        if (errors.length > 0) {
          if (validationRetries++ >= SCRIPT_VALIDATION_RETRIES) throw new Error(`대본 검증 실패: ${errors.join("; ")}`);
          feedback = errors;
          fallbacks.push({ step: "script", detail: `의도 검증 실패 → 오류를 붙여 재생성: ${errors.join("; ")}` });
          continue;
        }
        writeScript(script);
        const kinds = script.scenes.map((s) => (s.type === "diagram" ? "diagram" : (s.visual as { kind?: string } | null)?.kind ?? s.type));
        rec.notes.push(`씬 ${script.scenes.length}개: ${kinds.join(", ")}`);
        return;
      }
    });

    await step("cast", async (rec) => {
      rec.attempts = 1;
      const script = readScript();
      for (const scene of script.scenes.filter((s) => s.type === "code")) {
        const resolved = deps.castCommands(projectId, scene);
        if (!resolved || resolved.commands.length === 0) {
          for (const r of resolved?.rejected ?? []) fallbacks.push({ step: "cast", detail: `정책 거부: ${r.display} — ${r.reason}` });
          rec.notes.push(`${scene.id}: 실행할 명령 없음 → 정적 코드 표시`);
          continue;
        }
        for (const r of resolved.rejected) fallbacks.push({ step: "cast", detail: `정책 거부: ${r.display} — ${r.reason}` });
        const result = deps.runCast(resolved.commands, { width: 100, height: 30 });
        for (const s of result.skipped) fallbacks.push({ step: "cast", detail: `명령 실패로 제외: ${s.display} — ${s.reason}` });
        if (result.cast) scene.props = { ...scene.props, cast: result.cast };
        rec.notes.push(`${scene.id}: ${result.ran.length}개 명령 실행`);
      }
      writeScript(script);
    });

    await step("narration", async (rec) => {
      for (let attempt = 0; ; attempt++) {
        rec.attempts++;
        try {
          writeScript(await deps.narrate(projectId, readScript()));
          return;
        } catch (err) {
          if (attempt >= TTS_RETRY_DELAYS_MS.length) throw err;
          fallbacks.push({ step: "narration", detail: `TTS 실패 → ${TTS_RETRY_DELAYS_MS[attempt] / 1000}초 후 재시도: ${(err as Error).message.slice(0, 120)}` });
          await deps.sleep(TTS_RETRY_DELAYS_MS[attempt]);
        }
      }
    });

    await step("visuals", async (rec) => {
      rec.attempts = 1;
      const events = await deps.visuals(projectId);
      for (const e of events) fallbacks.push({ step: "visuals", detail: `${e.sceneId}: ${e.from} → ${e.to} (${e.reason})` });
      rec.notes.push(`폴백 ${events.length}건`);
    });

    await step("render", async (rec) => {
      rec.attempts++;
      if (deps.render(projectId) === 0) return;
      rec.attempts++;
      fallbacks.push({ step: "render", detail: "렌더 실패 → 1회 재시도" });
      if (deps.render(projectId) === 0) return;
      const { script, demoted } = demoteDiagramScenes(readScript());
      if (demoted.length === 0) throw new Error("렌더 2회 실패");
      writeScript(script);
      for (const d of demoted) fallbacks.push({ step: "render", detail: d });
      rec.attempts++;
      if (deps.render(projectId) !== 0) throw new Error("3D를 내린 뒤에도 렌더 실패");
    });

    floor = assessAiVisualFloor(readScript());

    await step("upload", async (rec) => {
      if (options.dryRun) {
        rec.notes.push("dry-run — 업로드 건너뜀");
        return;
      }
      rec.attempts = 1;
      if (deps.upload(projectId) !== 0) throw new Error("youtube_upload.py 실패");
      const resultPath = path.join(projectDir, "output", `${projectId}.upload_result.json`);
      const result = JSON.parse(fs.readFileSync(resultPath, "utf-8")) as { youtube_url?: string; uploaded_privacy?: string; playlist_result?: { added?: boolean } };
      uploadUrl = result.youtube_url ?? null;
      rec.notes.push(`privacy=${result.uploaded_privacy}`);
      if (result.playlist_result && result.playlist_result.added === false) {
        interventions.push({ step: "upload", reason: "재생목록 자동 추가 실패 — YouTube Studio에서 수동 추가 필요" });
      }
    });
  } catch (err) {
    if (!(err instanceof StepFailed)) throw err;
  } finally {
    report = {
      projectId,
      mode: options.dryRun ? "dry-run" : "full",
      startedAt,
      finishedAt: new Date().toISOString(),
      steps,
      fallbacks,
      interventions,
      floor,
      neuronsUsed: Math.round((deps.neuronsToday() - neuronsAtStart) * 10) / 10,
      uploadUrl,
      verdict: "",
    };
    report.verdict = decideVerdict(report);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(report, null, 2));
    appendRunLog(projectDir, report);
    log(`\n결과: ${report.verdict}\n사람 개입(이 실행 중): ${interventions.length}건 / 자동 폴백: ${fallbacks.length}건`);
  }
  return report;
}
