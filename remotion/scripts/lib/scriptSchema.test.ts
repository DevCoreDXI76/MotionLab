import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NARRATION_MAX_CHARS, validateNarrationLength, validateNoNextEpisodeTease, validateScript } from "./scriptSchema";
import { PROJECTS_DIR } from "./paths";

const validScript = {
  id: "001_sample",
  title: "샘플 편",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "안녕하세요", subtitleText: null, durationMs: null, audioPath: null, props: { title: "안녕" } },
  ],
};

describe("validateScript", () => {
  it("accepts a minimal valid script", () => {
    const result = validateScript(validScript);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a script missing required fields", () => {
    const { id, ...withoutId } = validScript;
    const result = validateScript(withoutId);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("rejects an unknown scene type", () => {
    const bad = { ...validScript, scenes: [{ ...validScript.scenes[0], type: "unknownType" }] };
    const result = validateScript(bad);
    expect(result.valid).toBe(false);
  });

  it("accepts a script with no visual field (backward compatibility with pre-existing script.json files)", () => {
    const result = validateScript(validScript);
    expect(result.valid).toBe(true);
  });

  it("accepts a scene with a visual field (cue-only, no assetPath)", () => {
    const withVisual = {
      ...validScript,
      scenes: [{ ...validScript.scenes[0], visual: { cue: "terminal", assetPath: null, focal: "center" } }],
    };
    expect(validateScript(withVisual).valid).toBe(true);
  });

  it("rejects a visual field with an unknown property", () => {
    const bad = {
      ...validScript,
      scenes: [{ ...validScript.scenes[0], visual: { kind: "image" } }],
    };
    expect(validateScript(bad).valid).toBe(false);
  });

  it("rejects a visual field with a property outside the schema", () => {
    const bad = {
      ...validScript,
      scenes: [{ ...validScript.scenes[0], visual: { kind: "aiImage", seed: 1 } }],
    };
    expect(validateScript(bad).valid).toBe(false);
  });

  it("accepts 2기 visual intent + source fields and the diagram scene type", () => {
    const script = {
      ...validScript,
      scenes: [
        {
          ...validScript.scenes[0],
          visual: { kind: "aiImage", prompt: "hands on a keyboard", query: "hands typing close up", assetPath: null, source: { provider: "cloudflare-workers-ai" } },
        },
        { id: "d1", type: "diagram", narration: "구조예요.", props: { heading: "구조", labels: ["대본", "TTS", "렌더"] } },
      ],
    };
    expect(validateScript(script)).toEqual({ valid: true, errors: [] });
  });

  // Absolute rule 6 (docs/2단계_설계.md §7): every existing episode must keep validating unchanged.
  const episodeIds = fs.readdirSync(PROJECTS_DIR).filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "script.json")));
  it.each(episodeIds)("existing episode %s still validates", (id) => {
    const script = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, id, "script.json"), "utf-8"));
    expect(validateScript(script)).toEqual({ valid: true, errors: [] });
  });
});

describe("validateNarrationLength", () => {
  const withNarration = (...narrations: string[]) => ({
    scenes: narrations.map((narration, i) => ({ id: `s${i}`, narration })),
  });

  it("accepts narration exactly at the cap (whitespace not counted)", () => {
    const half = "가".repeat(NARRATION_MAX_CHARS / 2);
    expect(validateNarrationLength(withNarration(`${half} `, ` ${half}\n`))).toEqual([]);
  });

  it("rejects narration one character over the cap", () => {
    const errors = validateNarrationLength(withNarration("가".repeat(NARRATION_MAX_CHARS), "나"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`${NARRATION_MAX_CHARS + 1}자`);
  });
});

describe("validateNoNextEpisodeTease", () => {
  const CONCEPT_009 = "## 톤·길이\n정보성 쇼츠, 45~60초. 이전 편 번호는 쓰지 않는다. 다음 편 예고 문구는 쓰지 않는다.\n";
  const outro = (props: Record<string, unknown>, narration = "끝입니다.") => ({ scenes: [{ id: "s5", type: "outro", narration, props }] });

  it("accepts an outro with ctaText null (render props stay schema-valid)", () => {
    const script = { ...validScript, scenes: [{ ...validScript.scenes[0], type: "outro", props: { message: "끝", ctaText: null } }] };
    expect(validateScript(script)).toEqual({ valid: true, errors: [] });
    expect(validateNoNextEpisodeTease(script, CONCEPT_009)).toEqual([]);
  });

  it("rejects '다음 편' in ctaText when the concept does not announce a next episode", () => {
    const errors = validateNoNextEpisodeTease(outro({ message: "끝", ctaText: "다음 편에서 계속" }), CONCEPT_009);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("s5");
  });

  it("rejects '다음 편' in narration too", () => {
    expect(validateNoNextEpisodeTease(outro({ message: "끝" }, "다음 편에서 만나요."), CONCEPT_009)).toHaveLength(1);
  });

  it("allows it when the concept itself announces the next episode", () => {
    const concept = "## 마무리\n다음 편 예고: 썸네일 자동화를 다룬다.\n";
    expect(validateNoNextEpisodeTease(outro({ message: "끝", ctaText: "다음 편에서 계속" }), concept)).toEqual([]);
  });
});
