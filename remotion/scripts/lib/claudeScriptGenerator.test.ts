import { describe, expect, it } from "vitest";
import { buildAuthoringSchema, buildPrompt, generateScript } from "./claudeScriptGenerator";
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

  it("hands claude -p a schema without runtime-only fields", () => {
    const schema = buildAuthoringSchema() as { properties: { scenes: { items: { properties: Record<string, { properties?: Record<string, unknown> }> } } } };
    const sceneProps = schema.properties.scenes.items.properties;
    expect(sceneProps.durationMs).toBeUndefined();
    expect(sceneProps.audioPath).toBeUndefined();
    expect(Object.keys(sceneProps.visual.properties ?? {})).toEqual(["cue", "focal", "kind", "query", "prompt", "clipId"]);
    expect(schema).not.toHaveProperty("$schema");
  });

  it("fills every template placeholder, incl. clip registry and command allowlist", () => {
    const prompt = buildPrompt("주제", "shorts", "008_x");
    expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(prompt).toContain("flow_01:");
    expect(prompt).toContain("npx vitest run");
    expect(prompt).toContain("**정적 포즈만**");
  });

  it("says composition is not fixed and drops the diagram when no new 3D kind is left (device ③)", () => {
    const prompt = buildPrompt("주제", "shorts", "010_x", { availableDiagramKinds: [] });
    expect(prompt).toContain("씬 구성은 고정이 아닙니다");
    expect(prompt).toContain("aiImage는 1~2개");
    expect(prompt).toContain("diagram(3D) 씬은 쓰지 마세요");
    expect(buildPrompt("주제", "shorts", "010_x", { availableDiagramKinds: ["stack"] })).toContain("diagram 씬은 0~1개(선택)");
  });

  it("lists only the clips the asset ledger still allows (device ②)", () => {
    const prompt = buildPrompt("주제", "shorts", "010_x", { availableClipIds: [] });
    expect(prompt).not.toContain("flow_01:");
    expect(prompt).toContain("사용할 수 있는 기존 클립이 없습니다");
  });
});
