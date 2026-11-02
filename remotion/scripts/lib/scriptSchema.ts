import fs from "node:fs";
import path from "node:path";
import Ajv, { ErrorObject } from "ajv";
import { TEMPLATES_DIR } from "./paths";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const schemaPath = path.join(TEMPLATES_DIR, "script_schema.json");
const schemaJson = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(schemaJson);

export function validateScript(data: unknown): ValidationResult {
  const valid = validateFn(data) as boolean;
  const errors = (validateFn.errors ?? []).map(
    (e: ErrorObject) => `${e.instancePath || "(root)"} ${e.message}`,
  );
  return { valid, errors };
}

/**
 * Total narration ceiling (whitespace excluded) for newly generated scripts. 006~008 measured
 * Edge TTS at ~4.9~5.3 chars/s, so 320 chars is ~60~65s — a coarse guard only; the measured
 * duration gate in runPipeline is what enforces ≤59s. Not part of validateScript, because
 * existing episodes (008: 351 chars) must keep validating for re-render.
 */
export const NARRATION_MAX_CHARS = 320;

export function validateNarrationLength(script: { scenes: Array<{ narration: string }> }): string[] {
  const chars = script.scenes.reduce((sum, s) => sum + s.narration.replace(/\s+/g, "").length, 0);
  return chars > NARRATION_MAX_CHARS ? [`나레이션 총 ${chars}자(공백 제외) — 상한 ${NARRATION_MAX_CHARS}자를 넘음. 문장을 줄이세요`] : [];
}

const NEXT_EPISODE = "다음 편";

/**
 * Backlog 4: the script writer kept promising a next episode ("다음 편에서 계속"). Such a tease is
 * allowed only when concept.md itself announces one — a concept line mentioning "다음 편" that is
 * not a prohibition ("…쓰지 않는다", "금지").
 */
export function validateNoNextEpisodeTease(script: { scenes: Array<{ id: string; narration: string; subtitleText?: string | null; props?: unknown }> }, concept: string): string[] {
  const announced = concept.split(/\r?\n/).some((line) => line.includes(NEXT_EPISODE) && !/않|금지|말 것|없/.test(line));
  if (announced) return [];
  return script.scenes
    .filter((s) => [s.narration, s.subtitleText ?? "", JSON.stringify(s.props ?? {})].some((t) => t.includes(NEXT_EPISODE)))
    .map((s) => `${s.id}: concept.md에 다음 편 예고가 없으므로 "${NEXT_EPISODE}" 예고 문구를 쓰지 마세요(outro ctaText는 생략 가능)`);
}
