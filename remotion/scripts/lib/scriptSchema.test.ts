import { describe, expect, it } from "vitest";
import { validateScript } from "./scriptSchema";

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
});
