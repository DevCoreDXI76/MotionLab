import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ClaudeCliRunner } from "./claudeCliRunner";
import type { CliRunner } from "./claudeCliRunner";
import { spawnCli } from "./spawnCli";
import { ROOT_DIR, TEMPLATES_DIR } from "./paths";
import type { Candidate, CandidateJudge, JudgedCandidate } from "./visualProviders/aiImage";

/**
 * Backlog 3 (docs/2단계_설계.md D2): replaces the human candidate review from the 008 spike.
 * Hard defects (face, hand distortion, readable fake text, white border) reject a candidate;
 * action compliance only ranks the survivors. Fail-closed: if the judge cannot produce a valid
 * verdict, the candidate is rejected — passing a defect is worse than losing a good image.
 */

export interface VisionFindings {
  face_visible: boolean;
  hand_distortion: boolean;
  readable_fake_text: boolean;
  white_border: boolean;
  action: "yes" | "partial" | "no";
  reasons: string[];
}

export const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    face_visible: { type: "boolean" },
    hand_distortion: { type: "boolean" },
    readable_fake_text: { type: "boolean" },
    white_border: { type: "boolean" },
    action: { type: "string", enum: ["yes", "partial", "no"] },
    reasons: { type: "array", items: { type: "string" } },
  },
  required: ["face_visible", "hand_distortion", "readable_fake_text", "white_border", "action", "reasons"],
  additionalProperties: false,
};

const DEFECTS: Array<[keyof VisionFindings, string]> = [
  ["face_visible", "얼굴 노출"],
  ["hand_distortion", "손 왜곡"],
  ["readable_fake_text", "초점 맞은 가짜 글자"],
  ["white_border", "흰 테두리"],
];
const ACTION_SCORE = { yes: 2, partial: 1, no: 0 } as const;

export function verdictFromFindings(findings: VisionFindings): Pick<JudgedCandidate, "verdict" | "score" | "reasons"> {
  const defects = DEFECTS.filter(([key]) => findings[key] === true).map(([, label]) => label);
  return {
    verdict: defects.length > 0 ? "fail" : "pass",
    score: ACTION_SCORE[findings.action],
    reasons: [...defects.map((d) => `결함: ${d}`), ...findings.reasons],
  };
}

function isFindings(value: unknown): value is VisionFindings {
  const v = value as Record<string, unknown> | null;
  return (
    !!v &&
    ["face_visible", "hand_distortion", "readable_fake_text", "white_border"].every((k) => typeof v[k] === "boolean") &&
    (v.action === "yes" || v.action === "partial" || v.action === "no") &&
    Array.isArray(v.reasons)
  );
}

export function buildJudgePrompt(imagePath: string, prompt: string): string {
  return fs
    .readFileSync(path.join(TEMPLATES_DIR, "judge_rubric.md"), "utf-8")
    .replace("{{IMAGE_PATH}}", imagePath.replace(/\\/g, "/"))
    .replace("{{PROMPT}}", prompt);
}

/** One `claude -p` call per image, Read allowed only for the image's own folder. Throws on any malformed result. */
export function judgeImageWithClaude(runner: CliRunner, absPath: string, prompt: string): VisionFindings {
  const { status, stdout, stderr } = runner.run([
    "-p",
    buildJudgePrompt(absPath, prompt),
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(FINDINGS_SCHEMA),
    "--allowedTools",
    "Read",
    "--add-dir",
    path.dirname(absPath),
    "--permission-mode",
    "dontAsk",
  ]);
  if (status !== 0) {
    throw new Error(`claude -p (judge) exited with status ${status}: ${stderr.slice(0, 300)}`);
  }
  const parsed = JSON.parse(stdout) as { structured_output?: unknown };
  if (!isFindings(parsed.structured_output)) {
    throw new Error(`judge returned no valid findings: ${stdout.slice(0, 300)}`);
  }
  return parsed.structured_output;
}

/**
 * Pixel rule for ⓓ, independent of the model: shrink to 54x96 grayscale and flag any side whose
 * outer 2px band is ≥90% near-white (schnell's framed output in the spike looked like this).
 */
export function hasWhiteBorder(absPath: string): boolean {
  const W = 54;
  const H = 96;
  // spawnSync directly (not spawnCli): we need the raw stdout bytes, and ffmpeg is a real .exe.
  const result = spawnSync("ffmpeg", ["-v", "error", "-i", absPath, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"]);
  const px = result.stdout;
  if (result.status !== 0 || !px || px.length < W * H) {
    throw new Error(`ffmpeg could not read ${absPath} for the border check`);
  }
  const at = (x: number, y: number) => px[y * W + x];
  const sideWhite = (coords: Array<[number, number]>) =>
    coords.filter(([x, y]) => at(x, y) >= 230).length / coords.length >= 0.9;
  const band = (horizontal: boolean, start: number) => {
    const coords: Array<[number, number]> = [];
    for (let d = 0; d < 2; d++) {
      const len = horizontal ? W : H;
      for (let i = 0; i < len; i++) coords.push(horizontal ? [i, start + d] : [start + d, i]);
    }
    return coords;
  };
  return [band(true, 0), band(true, H - 2), band(false, 0), band(false, W - 2)].some(sideWhite);
}

export class ClaudeVisionJudge implements CandidateJudge {
  readonly name = "auto-vision" as const;

  constructor(
    private readonly runner: CliRunner = new ClaudeCliRunner(),
    private readonly attempts = 2,
    private readonly log: (m: string) => void = () => {},
  ) {}

  async judge(candidates: Candidate[], prompt: string): Promise<JudgedCandidate[]> {
    return candidates.map((candidate) => {
      let border = false;
      try {
        border = hasWhiteBorder(candidate.absPath);
      } catch (err) {
        this.log(`border check failed for ${candidate.file}: ${(err as Error).message}`);
      }
      for (let attempt = 1; attempt <= this.attempts; attempt++) {
        try {
          const findings = judgeImageWithClaude(this.runner, candidate.absPath, prompt);
          const verdict = verdictFromFindings({ ...findings, white_border: findings.white_border || border });
          if (border && !findings.white_border) verdict.reasons.push("픽셀 규칙: 가장자리 흰 테두리");
          return { ...candidate, ...verdict, findings };
        } catch (err) {
          this.log(`judge attempt ${attempt} failed for ${candidate.file}: ${(err as Error).message}`);
        }
      }
      return { ...candidate, verdict: "fail" as const, score: 0, reasons: ["판정기 오류 — 안전을 위해 탈락 처리"] };
    });
  }
}

/** Runs scripts/face_check.py (OpenCV Haar cascades) on the given images; returns face counts by path. */
export function countFaces(absPaths: string[]): Record<string, number> {
  const result = spawnCli("py", [path.join(ROOT_DIR, "scripts", "face_check.py"), ...absPaths], { stdio: "pipe", timeoutMs: 60_000 });
  if (result.status !== 0) {
    throw new Error(`face_check.py exited ${result.status}: ${result.stderr.slice(0, 300)}`);
  }
  return JSON.parse(result.stdout) as Record<string, number>;
}

/**
 * Production judge since the D2 measurement (2026-10-30): the Claude vision judge failed the bar
 * (1 defect passed, 5/9 false rejects — see docs/2단계_설계.md D2 result), so candidates are
 * checked only by rules that are actually reliable: face detection and the white-border pixel
 * rule. Hand distortion and readable fake text are NOT checked — those defects can reach ⑦ final
 * review, which is why aiImage is capped at 2 scenes. Fail-closed on any checker error.
 */
export class PixelRuleJudge implements CandidateJudge {
  readonly name = "auto-rule" as const;

  constructor(
    private readonly faces: (absPaths: string[]) => Record<string, number> = countFaces,
    private readonly border: (absPath: string) => boolean = hasWhiteBorder,
  ) {}

  async judge(candidates: Candidate[]): Promise<JudgedCandidate[]> {
    let faceCounts: Record<string, number> | null = null;
    let faceError = "";
    try {
      faceCounts = this.faces(candidates.map((c) => c.absPath));
    } catch (err) {
      faceError = (err as Error).message;
    }
    return candidates.map((candidate) => {
      const reasons: string[] = [];
      const faces = faceCounts?.[candidate.absPath];
      if (faces == null) reasons.push(`얼굴 검사 실패 — 안전을 위해 탈락 처리${faceError ? ` (${faceError})` : ""}`);
      else if (faces > 0) reasons.push(`결함: 얼굴 검출 ${faces}건`);
      let whiteBorder: boolean | null = null;
      try {
        whiteBorder = this.border(candidate.absPath);
        if (whiteBorder) reasons.push("결함: 흰 테두리");
      } catch (err) {
        reasons.push(`테두리 검사 실패 — 안전을 위해 탈락 처리 (${(err as Error).message})`);
      }
      return {
        ...candidate,
        verdict: reasons.length > 0 ? "fail" : "pass",
        score: 0,
        reasons,
        findings: { faces: faces ?? null, whiteBorder, checked: ["face", "white_border"], notChecked: ["hand_distortion", "readable_fake_text"] },
      };
    });
  }
}
