import fs from "node:fs";
import path from "node:path";
import { TEMPLATES_DIR } from "./paths";

/**
 * Applies pronunciation substitutions to text before it is sent to TTS.
 *
 * Substitution is scoped to the TTS input only — callers must never persist
 * the result back into script.json's narration or any subtitle/on-screen
 * text (see docs/remotion_트레이드오프_claudecode인계.md item 14). Keys are
 * matched longest-first so a shorter key can't clobber part of a longer one
 * (e.g. an "API" entry must not eat into a future "OpenAPI" entry), and each
 * key is regex-escaped so keys containing special characters (e.g.
 * "Node.js") work as literal matches.
 *
 * `\b` in JS is defined over `[A-Za-z0-9_]`, so it already resolves correctly
 * at a Korean/Latin boundary (e.g. "JSON을") without any extra handling —
 * the transition from "N" to "을" is itself a word/non-word boundary.
 */
export function applyLexicon(text: string, lexicon: Record<string, string>): string {
  const keys = Object.keys(lexicon).sort((a, b) => b.length - a.length);
  return keys.reduce((acc, key) => {
    const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, "g");
    return acc.replace(pattern, lexicon[key]);
  }, text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Loads templates/tts_lexicon.json, matching the load pattern in scriptSchema.ts. */
export function loadLexicon(): Record<string, string> {
  const lexiconPath = path.join(TEMPLATES_DIR, "tts_lexicon.json");
  return JSON.parse(fs.readFileSync(lexiconPath, "utf-8"));
}
