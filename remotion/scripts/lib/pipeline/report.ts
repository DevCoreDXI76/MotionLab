import fs from "node:fs";
import path from "node:path";
import type { FloorAssessment } from "../visualIntent";

export type StepName = "preflight" | "script" | "cast" | "narration" | "visuals" | "render" | "upload";
export const STEP_ORDER: StepName[] = ["preflight", "script", "cast", "narration", "visuals", "render", "upload"];

export interface StepRecord {
  name: StepName;
  status: "ok" | "failed" | "skipped";
  attempts: number;
  seconds: number;
  notes: string[];
}

/** An automatic fallback/retry the pipeline resolved by itself — NOT a human intervention. */
export interface AutoFallback {
  step: StepName;
  detail: string;
}

/** Something a person had to do (or decide) during the run — counts toward the ≤2 limit. */
export interface Intervention {
  step: StepName | "run";
  reason: string;
}

export interface RunReport {
  projectId: string;
  mode: "dry-run" | "full";
  startedAt: string;
  finishedAt: string;
  steps: StepRecord[];
  fallbacks: AutoFallback[];
  interventions: Intervention[];
  floor: FloorAssessment | null;
  neuronsUsed: number;
  uploadUrl: string | null;
  verdict: string;
}

export const VERDICTS = {
  stopped: "중단 — 사람 개입 필요",
  floorMissed: "완주했으나 2기 목표 미충족(AI 비주얼 하한 미달)",
  dryRunDone: "dry-run 완주(업로드 제외) — AI 비주얼 하한 충족",
  uploaded: "비공개 업로드 완료 — ⑦ 최종 검수 대기 (완성 판정은 ⑦ 승인 후)",
} as const;

/**
 * Verdict rules (docs/2단계_설계.md §5.2.1): a stopped run is never "done"; a finished run that
 * lost the AI-visual floor is reported as not meeting the 2기 goal even though it uploaded.
 */
export function decideVerdict(report: Pick<RunReport, "steps" | "floor" | "mode" | "uploadUrl">): string {
  const failed = report.steps.some((s) => s.status === "failed");
  if (failed || !report.floor) return VERDICTS.stopped;
  if (!report.floor.met) return VERDICTS.floorMissed;
  return report.mode === "dry-run" ? VERDICTS.dryRunDone : VERDICTS.uploaded;
}

export function renderRunLog(report: RunReport): string {
  const lines: string[] = [];
  lines.push(`### ${report.startedAt.slice(0, 16).replace("T", " ")} UTC — ${report.mode === "dry-run" ? "dry-run" : "실행"}: **${report.verdict}**`);
  lines.push("");
  lines.push("| 단계 | 결과 | 시도 | 소요 | 메모 |");
  lines.push("|---|---|---|---|---|");
  for (const s of report.steps) {
    const mark = s.status === "ok" ? "✅" : s.status === "failed" ? "❌" : "—";
    lines.push(`| ${s.name} | ${mark} ${s.status} | ${s.attempts} | ${s.seconds}초 | ${s.notes.join("<br>").replace(/\|/g, "\\|") || ""} |`);
  }
  lines.push("");
  lines.push(`- **사람 개입(이 실행 중)**: ${report.interventions.length}건${report.interventions.length ? "" : " — ①(concept.md 작성)과 ⑦(최종 검수) 외 없음"}`);
  for (const i of report.interventions) lines.push(`  - ⚠ ${i.step}: ${i.reason}`);
  lines.push(`- 자동 폴백·재시도: ${report.fallbacks.length}건 (사람 개입 아님)`);
  for (const f of report.fallbacks) lines.push(`  - ${f.step}: ${f.detail}`);
  if (report.floor) {
    const f = report.floor;
    lines.push(`- AI 비주얼 하한: ${f.met ? "충족" : "**미달**"} (aiImage ${f.aiImage}/2, diagram ${f.diagram}/1)${f.lost.length ? ` — 폴백된 씬: ${f.lost.join(", ")}` : ""}`);
  }
  lines.push(`- Cloudflare neurons(추정): ${report.neuronsUsed}`);
  if (report.uploadUrl) lines.push(`- 업로드(비공개): ${report.uploadUrl}`);
  lines.push("");
  return lines.join("\n");
}

const LOG_HEADER = "## 자동 실행 기록 (produce.ts)";

/** Appends this run to projects/<id>/log.md under the auto-run section, leaving hand-written sections alone. */
export function appendRunLog(projectDir: string, report: RunReport): void {
  const logPath = path.join(projectDir, "log.md");
  const existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf-8") : `# ${report.projectId} — log.md\n`;
  const withHeader = existing.includes(LOG_HEADER) ? existing : `${existing.trimEnd()}\n\n${LOG_HEADER}\n\n*오케스트레이터가 실행마다 자동으로 남긴다. 사람 개입 집계는 M4 실전 실행 기준.*\n`;
  fs.writeFileSync(logPath, `${withHeader.trimEnd()}\n\n${renderRunLog(report)}`);
}
