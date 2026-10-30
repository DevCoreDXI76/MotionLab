import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildJudgePrompt, ClaudeVisionJudge, hasWhiteBorder, PixelRuleJudge, verdictFromFindings } from "./candidateJudge";
import type { VisionFindings } from "./candidateJudge";
import type { CliRunner } from "./claudeCliRunner";

let tmp: string;
let gray: string;
let framed: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "judge-test-"));
  gray = path.join(tmp, "gray.jpg");
  framed = path.join(tmp, "framed.jpg");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x303030:s=1080x1920", "-frames:v", "1", gray]);
  // A dark image inside a thick white frame — the schnell failure mode from the spike.
  spawnSync("ffmpeg", ["-v", "error", "-y", "-i", gray, "-vf", "pad=1240:2080:80:80:white,scale=1080:1920", framed]);
});

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const candidate = (absPath: string) => ({ file: path.basename(absPath), absPath, seed: 1, round: 0 });
const findings = (overrides: Partial<VisionFindings> = {}): VisionFindings => ({
  face_visible: false,
  hand_distortion: false,
  readable_fake_text: false,
  white_border: false,
  action: "yes",
  reasons: [],
  ...overrides,
});

describe("verdictFromFindings", () => {
  it("rejects any hard defect and ranks survivors by action compliance", () => {
    expect(verdictFromFindings(findings())).toEqual({ verdict: "pass", score: 2, reasons: [] });
    expect(verdictFromFindings(findings({ action: "partial" })).score).toBe(1);
    expect(verdictFromFindings(findings({ hand_distortion: true, reasons: ["손가락 6개"] }))).toEqual({
      verdict: "fail",
      score: 2,
      reasons: ["결함: 손 왜곡", "손가락 6개"],
    });
  });
});

describe("hasWhiteBorder", () => {
  it("flags a white-framed image and passes a plain dark one", () => {
    expect(hasWhiteBorder(framed)).toBe(true);
    expect(hasWhiteBorder(gray)).toBe(false);
  });
});

describe("PixelRuleJudge", () => {
  it("passes clean candidates and records what it could not check", async () => {
    const judge = new PixelRuleJudge(() => ({ [gray]: 0 }), () => false);
    const [result] = await judge.judge([candidate(gray)]);
    expect(result).toMatchObject({
      verdict: "pass",
      reasons: [],
      findings: { faces: 0, whiteBorder: false, notChecked: ["hand_distortion", "readable_fake_text"] },
    });
  });

  it("rejects detected faces and white borders", async () => {
    const judge = new PixelRuleJudge(() => ({ [gray]: 2, [framed]: 0 }));
    const [a, b] = await judge.judge([candidate(gray), candidate(framed)]);
    expect(a).toMatchObject({ verdict: "fail", reasons: ["결함: 얼굴 검출 2건"] });
    expect(b).toMatchObject({ verdict: "fail", reasons: ["결함: 흰 테두리"] });
  });

  it("fails closed when the face checker breaks", async () => {
    const judge = new PixelRuleJudge(() => {
      throw new Error("cv2 missing");
    }, () => false);
    const [result] = await judge.judge([candidate(gray)]);
    expect(result.verdict).toBe("fail");
    expect(result.reasons[0]).toContain("얼굴 검사 실패");
  });

  it("runs the real face_check.py on a face-free image", async () => {
    const [result] = await new PixelRuleJudge().judge([candidate(gray)]);
    expect(result).toMatchObject({ verdict: "pass", findings: { faces: 0, whiteBorder: false } });
  });
});

describe("ClaudeVisionJudge (kept for re-evaluation, not used in production — D2)", () => {
  it("lets claude read only the image's own folder", () => {
    const run = vi.fn<CliRunner["run"]>(() => ({ status: 0, stdout: JSON.stringify({ structured_output: findings() }), stderr: "" }));
    new ClaudeVisionJudge({ run }).judge([candidate(gray)], "hands");
    const args = run.mock.calls[0][0];
    expect(args.slice(args.indexOf("--allowedTools"), args.indexOf("--allowedTools") + 4)).toEqual(["--allowedTools", "Read", "--add-dir", tmp]);
    expect(buildJudgePrompt("C:\\x\\a.jpg", "p")).toContain("C:/x/a.jpg");
  });

  it("fails closed after its retries when claude returns garbage", async () => {
    const run = vi.fn<CliRunner["run"]>(() => ({ status: 0, stdout: JSON.stringify({ structured_output: { nope: 1 } }), stderr: "" }));
    const [result] = await new ClaudeVisionJudge({ run }, 2).judge([candidate(gray)], "hands");
    expect(run).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ verdict: "fail", reasons: ["판정기 오류 — 안전을 위해 탈락 처리"] });
  });
});
