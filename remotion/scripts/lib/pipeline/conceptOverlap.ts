import fs from "node:fs";
import path from "node:path";

/**
 * Anti-repetition device ① (docs/ClaudeCode_프롬프트_반복방지.md): a new episode's concept.md is
 * compared with every earlier episode's concept.md + script narration before anything is generated.
 * 009 was rejected at ⑦ because its topic was mined from 008's production log ("0원 / 일곱 단계").
 *
 * Thresholds were fixed on real episodes (009↔008 must be a duplicate, 008↔007 and 007↔006 must pass).
 * Character 2-gram Jaccard turned out NOT to separate them (009↔008 0.046 vs 007↔006 0.103) — shared
 * numeric facts do. Jaccard stays as a near-copy guard set above every observed pair.
 */
export const JACCARD_MAX = 0.2;
export const SHARED_FACTS_MAX = 2;

export interface EpisodeText {
  id: string;
  concept: string;
  narration: string;
}

export interface OverlapResult {
  duplicate: boolean;
  jaccard: number;
  sharedFacts: string[];
}

const CORE_SECTIONS = /^(한 줄 컨셉|핵심 메시지|다루는)/;

/** The topic-bearing part of a concept.md: one-line concept, key message, evidence sections. */
export function conceptCore(md: string): string {
  return md
    .split(/^## /m)
    .slice(1)
    .filter((section) => CORE_SECTIONS.test(section))
    .map((section) => section.split("\n").slice(1).join("\n"))
    .join("\n");
}

const NUMBER_WORDS: Record<string, string> = { 한: "1", 두: "2", 세: "3", 네: "4", 다섯: "5", 여섯: "6", 일곱: "7", 여덟: "8", 아홉: "9", 열: "10" };
const FACT_PATTERN = /(\d+(?:\.\d+)?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(분|초|원|배|단계|회|건|장|개|편|곳|가지|%)/g;

/** Number+unit facts ("7단계", "0원", "1.7배"); "일곱 단계" → "7단계". "One" is dropped — "쇼츠 한 편" is not a fact. */
export function numericFacts(text: string): Set<string> {
  const facts = new Set<string>();
  for (const m of text.matchAll(FACT_PATTERN)) {
    const value = NUMBER_WORDS[m[1]] ?? m[1];
    if (value !== "1") facts.add(value + m[2]);
  }
  return facts;
}

function bigrams(text: string): Set<string> {
  const s = text.replace(/[^\p{L}\p{N}]/gu, "");
  const grams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) grams.add(s.slice(i, i + 2));
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

export function compareConcepts(newConcept: string, previous: EpisodeText): OverlapResult {
  const core = conceptCore(newConcept);
  const prevText = `${conceptCore(previous.concept)}\n${previous.narration}`;
  const score = jaccard(bigrams(core), bigrams(prevText));
  const prevFacts = numericFacts(`${previous.concept}\n${previous.narration}`);
  const sharedFacts = [...numericFacts(core)].filter((f) => prevFacts.has(f));
  return {
    duplicate: score > JACCARD_MAX || sharedFacts.length >= SHARED_FACTS_MAX,
    jaccard: Math.round(score * 1000) / 1000,
    sharedFacts,
  };
}

export function loadEpisode(projectsDir: string, id: string): EpisodeText | null {
  const conceptPath = path.join(projectsDir, id, "concept.md");
  if (!fs.existsSync(conceptPath)) return null;
  const scriptPath = path.join(projectsDir, id, "script.json");
  const narration = fs.existsSync(scriptPath)
    ? (JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as { scenes: Array<{ narration: string }> }).scenes.map((s) => s.narration).join(" ")
    : "";
  return { id, concept: fs.readFileSync(conceptPath, "utf-8"), narration };
}

/** First earlier episode (by number prefix) whose topic the new concept repeats, or null. */
export function findConceptOverlap(projectsDir: string, projectId: string): (OverlapResult & { similarTo: string }) | null {
  const current = loadEpisode(projectsDir, projectId);
  if (!current) return null;
  const number = parseInt(projectId, 10);
  const earlier = fs
    .readdirSync(projectsDir)
    .filter((id) => id !== projectId && /^\d+_/.test(id) && parseInt(id, 10) < number)
    .sort()
    .reverse();
  for (const id of earlier) {
    const previous = loadEpisode(projectsDir, id);
    if (!previous) continue;
    const result = compareConcepts(current.concept, previous);
    if (result.duplicate) return { ...result, similarTo: id };
  }
  return null;
}

/** The log line device ① leaves when it stops a run — choosing a new topic is a human call (①). */
export function overlapMessage(result: OverlapResult & { similarTo: string }): string {
  const evidence = result.sharedFacts.length ? result.sharedFacts.join(", ") : `문장 유사도 ${result.jaccard}`;
  return `소재 중복 — ① 재선정 필요(유사 편: ${result.similarTo.slice(0, 3)}, 겹친 근거: ${evidence})`;
}
