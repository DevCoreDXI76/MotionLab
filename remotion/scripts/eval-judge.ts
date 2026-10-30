#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { ClaudeVisionJudge, PixelRuleJudge } from "./lib/candidateJudge";
import { PROJECTS_DIR } from "./lib/paths";

/**
 * Scores the candidate judge against the human review of the 008 spike's klein images
 * (projects/008_spike/spike/A_image/manifest.json) using the D2 bar: no human-rejected image may
 * pass, at most 2 human-accepted images may be rejected. Writes judge_eval_<judge>.json next to the manifest.
 *
 * Usage: npx tsx scripts/eval-judge.ts [vision|pixel]
 */

const SPIKE_DIR = path.join(PROJECTS_DIR, "008_spike", "spike", "A_image");
const MAX_FALSE_REJECTS = 2;

interface ManifestEntry {
  id: string;
  prompt: string;
  file: string;
  review: { face_visible: boolean; finger_distortion: string; keyboard_distortion: string; note: string };
}

/** Human verdict under the design's hard-defect rules (ⓐ face ⓑ hands ⓒ in-focus fake text). */
export function humanVerdict(review: ManifestEntry["review"]): { verdict: "pass" | "fail"; defects: string[] } {
  const defects: string[] = [];
  if (review.face_visible) defects.push("얼굴 노출");
  if (review.finger_distortion.startsWith("있음")) defects.push("손 왜곡");
  if (review.keyboard_distortion.startsWith("있음")) defects.push("초점 맞은 가짜 글자");
  return { verdict: defects.length > 0 ? "fail" : "pass", defects };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SPIKE_DIR, "manifest.json"), "utf-8")) as ManifestEntry[];
  const entries = manifest.filter((m) => m.id.startsWith("klein"));
  const judgeName = process.argv[2] === "pixel" ? "pixel" : "vision";
  const judge = judgeName === "pixel" ? new PixelRuleJudge() : new ClaudeVisionJudge(undefined, 2, (m) => console.log(`  ${m}`));

  const rows = [];
  for (const entry of entries) {
    const started = Date.now();
    const [judged] = await judge.judge(
      [{ file: entry.file, absPath: path.join(SPIKE_DIR, entry.file), seed: 0, round: 0 }],
      entry.prompt,
    );
    const human = humanVerdict(entry.review);
    const row = {
      id: entry.id,
      human: human.verdict,
      humanDefects: human.defects,
      judge: judged.verdict,
      judgeReasons: judged.reasons,
      findings: judged.findings ?? null,
      outcome:
        human.verdict === judged.verdict ? "match" : human.verdict === "fail" ? "DEFECT_PASSED" : "false_reject",
      seconds: Math.round((Date.now() - started) / 1000),
    };
    rows.push(row);
    console.log(`${row.id}: human ${row.human} / judge ${row.judge} → ${row.outcome} (${row.seconds}s) ${row.judgeReasons.join("; ")}`);
  }

  const defectPassed = rows.filter((r) => r.outcome === "DEFECT_PASSED").length;
  const falseRejects = rows.filter((r) => r.outcome === "false_reject").length;
  const passed = defectPassed === 0 && falseRejects <= MAX_FALSE_REJECTS;
  const summary = { judge: judgeName, evaluatedAt: new Date().toISOString(), images: rows.length, defectPassed, falseRejects, maxFalseRejects: MAX_FALSE_REJECTS, passed };
  fs.writeFileSync(path.join(SPIKE_DIR, `judge_eval_${judgeName}.json`), JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
