import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./paths";

/**
 * Anti-repetition device ② (docs/ClaudeCode_프롬프트_반복방지.md): data/used_assets.json records, per
 * episode, the assets a viewer has seen (or could see), so a new episode cannot reuse them. 009 was
 * rejected at ⑦ partly because its lamp/mug prompts, flow_01 clip, 3D stack scene and Pexels clip were
 * all 008's. Rules apply to newly generated scripts only — re-rendering 003~009 never reads this.
 */
export const LEDGER_PATH = path.join(ROOT_DIR, "data", "used_assets.json");

export interface EpisodeAssets {
  aiImagePrompts: string[];
  existingClips: string[];
  pexelsIds: number[];
  /** 3D (diagram) scene kinds, i.e. props.preset — "stack" is the only one so far. */
  diagramKinds: string[];
}

export interface AssetLedger {
  episodes: Record<string, EpisodeAssets>;
}

interface LedgerScene {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  visual?: { kind?: string; prompt?: string | null; clipId?: string | null; source?: { pexelsId?: unknown } | null } | null;
}

export function loadLedger(file = LEDGER_PATH): AssetLedger {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as AssetLedger) : { episodes: {} };
}

/** Upserts one episode — called right after a successful upload, and by the 003~009 backfill. */
export function recordEpisode(projectId: string, assets: EpisodeAssets, file = LEDGER_PATH): void {
  const ledger = loadLedger(file);
  ledger.episodes[projectId] = assets;
  const sorted = Object.fromEntries(Object.entries(ledger.episodes).sort(([a], [b]) => a.localeCompare(b)));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ episodes: sorted }, null, 2)}\n`);
}

/** Assets of one episode from its script.json, plus Pexels ids from its *.credit.json sidecars (pre-2기 episodes). */
export function collectEpisodeAssets(script: { scenes: LedgerScene[] }, creditPexelsIds: number[] = []): EpisodeAssets {
  const assets: EpisodeAssets = { aiImagePrompts: [], existingClips: [], pexelsIds: [...creditPexelsIds], diagramKinds: [] };
  for (const scene of script.scenes) {
    if (scene.type === "diagram") assets.diagramKinds.push(typeof scene.props?.preset === "string" ? scene.props.preset : "stack");
    const v = scene.visual;
    if (v?.kind === "aiImage" && v.prompt) assets.aiImagePrompts.push(v.prompt);
    if (v?.kind === "existingClip" && v.clipId) assets.existingClips.push(v.clipId);
    if (typeof v?.source?.pexelsId === "number") assets.pexelsIds.push(v.source.pexelsId);
  }
  assets.pexelsIds = [...new Set(assets.pexelsIds)];
  assets.diagramKinds = [...new Set(assets.diagramKinds)];
  assets.existingClips = [...new Set(assets.existingClips)];
  return assets;
}

/** Pexels ids recorded in public/projects/<id>/videos/*.credit.json (003~007 sidecars only carry pexelsUrl). */
export function creditPexelsIds(videosDir: string): number[] {
  if (!fs.existsSync(videosDir)) return [];
  return fs
    .readdirSync(videosDir)
    .filter((f) => f.endsWith(".credit.json"))
    .map((f) => {
      const credit = JSON.parse(fs.readFileSync(path.join(videosDir, f), "utf-8")) as { pexelsId?: unknown; pexelsUrl?: string };
      if (typeof credit.pexelsId === "number") return credit.pexelsId;
      const fromUrl = credit.pexelsUrl?.match(/-(\d+)\/?$/);
      return fromUrl ? Number(fromUrl[1]) : null;
    })
    .filter((id): id is number => typeof id === "number");
}

const others = (ledger: AssetLedger, projectId: string) => Object.entries(ledger.episodes).filter(([id]) => id !== projectId);

export function availableClipIds(ledger: AssetLedger, allClipIds: string[], projectId: string): string[] {
  const used = new Set(others(ledger, projectId).flatMap(([, a]) => a.existingClips));
  return allClipIds.filter((id) => !used.has(id));
}

export function ledgerPexelsIds(ledger: AssetLedger, projectId: string): Set<number> {
  return new Set(others(ledger, projectId).flatMap(([, a]) => a.pexelsIds));
}

export function usedDiagramKinds(ledger: AssetLedger, projectId: string): Set<string> {
  return new Set(others(ledger, projectId).flatMap(([, a]) => a.diagramKinds));
}

/**
 * Words that say nothing about the subject: filler, positions, light/mood adjectives, and the
 * channel's shared background (desk, wooden, light) — two prompts sharing only these are not a repeat.
 */
const NON_SUBJECT_WORDS = new Set([
  "a", "an", "the", "of", "on", "in", "at", "with", "and", "or", "beside", "across", "near", "over", "under", "into", "onto",
  "from", "by", "its", "their", "to", "behind", "next", "against", "through", "under", "above", "below", "around", "while",
  "desk", "wooden", "wood", "light", "lighting", "table", "surface", "background", "foreground",
  "dark", "warm", "soft", "dim", "low", "bright", "cool", "close", "up", "closeup", "shallow", "depth", "field", "view",
  "shot", "angle", "corner", "edge", "side", "top", "worn", "old", "night", "evening", "morning", "dawn",
]);

/** Subject nouns of an aiImage prompt — lower-case words minus NON_SUBJECT_WORDS and -ing/-ed/-ly forms. */
export function aiImageSubjects(prompt: string): Set<string> {
  const words = prompt.toLowerCase().match(/[a-z][a-z-]+/g) ?? [];
  return new Set(words.filter((w) => !NON_SUBJECT_WORDS.has(w) && !/(ing|ed|ly)$/.test(w)));
}

export const AI_IMAGE_SUBJECT_OVERLAP_MAX = 2;

/** aiImage prompts sharing 2+ subject nouns with any earlier episode's prompt — fed back to the script retry loop. */
export function findAiImageReuse(script: { scenes: LedgerScene[] }, ledger: AssetLedger, projectId: string): string[] {
  const previous = others(ledger, projectId).flatMap(([id, a]) => a.aiImagePrompts.map((p) => ({ id, subjects: aiImageSubjects(p) })));
  const errors: string[] = [];
  for (const scene of script.scenes) {
    if (scene.visual?.kind !== "aiImage" || !scene.visual.prompt) continue;
    const subjects = aiImageSubjects(scene.visual.prompt);
    for (const prev of previous) {
      const shared = [...subjects].filter((w) => prev.subjects.has(w));
      if (shared.length >= AI_IMAGE_SUBJECT_OVERLAP_MAX) {
        errors.push(`scene "${scene.id}": aiImage prompt repeats an earlier episode's image (${prev.id.slice(0, 3)}: ${shared.join(", ")}) — pick a different subject`);
        break;
      }
    }
  }
  return errors;
}

/**
 * Device ②/③ checks for a newly generated script: no reused aiImage subject, no reused existingClip,
 * and a diagram only with a 3D scene kind no earlier episode used.
 */
export function validateAssetReuse(script: { scenes: LedgerScene[] }, ledger: AssetLedger, projectId: string): string[] {
  const usedClips = new Set(others(ledger, projectId).flatMap(([, a]) => a.existingClips));
  const usedKinds = usedDiagramKinds(ledger, projectId);
  const errors = findAiImageReuse(script, ledger, projectId);
  for (const scene of script.scenes) {
    const clipId = scene.visual?.kind === "existingClip" ? scene.visual.clipId : null;
    if (clipId && usedClips.has(clipId)) errors.push(`scene "${scene.id}": existingClip ${clipId} was already used in an earlier episode`);
    if (scene.type === "diagram") {
      const kind = typeof scene.props?.preset === "string" ? scene.props.preset : "stack";
      if (usedKinds.has(kind)) errors.push(`scene "${scene.id}": 3D scene kind "${kind}" was already used in an earlier episode — drop the diagram scene`);
    }
  }
  return errors;
}
