import { describe, expect, it } from "vitest";
import { generateScript } from "./claudeScriptGenerator";
import type { CliRunner } from "./claudeCliRunner";

const VALID_SCRIPT = {
  id: "001_sample",
  title: "Remotion 자동화 쇼츠",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "안녕하세요, 모션랩입니다.", subtitleText: null, durationMs: null, audioPath: null, props: { title: "MotionLab" } },
    { id: "s2", type: "outro", narration: "다음 편에서 만나요.", subtitleText: null, durationMs: null, audioPath: null, props: { message: "다음 편에 만나요" } },
  ],
};

function fakeRunner(structuredOutput: unknown, status = 0): CliRunner {
  return {
    run: () => ({
      status,
      stdout: JSON.stringify({ structured_output: structuredOutput }),
      stderr: "",
    }),
  };
}

describe("generateScript", () => {
  it("returns a validated script object from structured_output", () => {
    const script = generateScript(fakeRunner(VALID_SCRIPT), "Remotion 소개", "shorts", "001_sample");
    expect(script).toEqual(VALID_SCRIPT);
  });

  it("throws when the claude CLI exits non-zero", () => {
    const runner: CliRunner = { run: () => ({ status: 1, stdout: "", stderr: "boom" }) };
    expect(() => generateScript(runner, "T", "shorts", "001_sample")).toThrow(/exited with status 1/);
  });

  it("throws when structured_output fails schema validation", () => {
    const runner = fakeRunner({ id: "x" }); // missing required fields
    expect(() => generateScript(runner, "T", "shorts", "001_sample")).toThrow(/schema validation/);
  });
});
