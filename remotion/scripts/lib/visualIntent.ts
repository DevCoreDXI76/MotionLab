import type { SceneVisual } from "./visualProviders/types";

interface IntentScene {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  visual?: SceneVisual | null;
}

// docs/2단계_설계.md §3: lower bounds = 2기 "AI visual floor"; aiImage max is 2 because the
// candidate judge only checks faces/borders (D2 result) — hand/text defects can reach ⑦ review.
// diagram counts scenes of type "diagram" (D1).
export const VISUAL_LIMITS = {
  aiImage: { min: 2, max: 2 },
  diagram: { min: 1, max: 2 },
  existingClip: { min: 0, max: 1 },
} as const;

export const DIAGRAM_LABELS = { min: 3, max: 7, maxChars: 8 } as const;

/**
 * Props that invite readable fake writing or small faces (D8: every defect in two 6-image rounds came
 * from a scene prompt that asked for paper). The prompt rule alone is not enough, so a scene prompt
 * naming one fails intent validation and the script is regenerated with the error attached.
 */
export const BANNED_AI_IMAGE_PROPS = [
  "notebook", "notepad", "sticky", "post-it", "postit", "paper", "book", "document", "receipt", "note", "memo",
  "letter", "poster", "photo", "photograph", "magazine", "newspaper",
] as const;
const BANNED_PROP_PATTERN = new RegExp(String.raw`\b(${BANNED_AI_IMAGE_PROPS.join("|")})(s|es)?\b`, "gi");

/** Banned prop words in an aiImage scene prompt, lower-cased and de-duplicated (whole words, plurals included). */
export function findBannedProps(prompt: string): string[] {
  return [...new Set([...prompt.matchAll(BANNED_PROP_PATTERN)].map((m) => m[0].toLowerCase()))];
}

/** Visual kinds only make sense on scenes that show a CentralVisual band. */
const BAND_SCENE_TYPES = new Set(["title", "talkingPoint", "outro"]);

/**
 * Semantic checks the JSON Schema leaves to code (kind-specific required fields, counts) — kept
 * out of the schema so `claude -p --json-schema` only ever sees flat optional fields.
 * Used on generated scripts (2기 episodes); 001~007 never go through it.
 */
export function validateVisualIntent(
  script: { scenes: IntentScene[] },
  knownClipIds: string[],
): string[] {
  const errors: string[] = [];
  const counts = { aiImage: 0, diagram: 0, existingClip: 0 };

  for (const scene of script.scenes) {
    const where = `scene "${scene.id}"`;
    if (scene.type === "diagram") {
      counts.diagram++;
      const labels = scene.props?.labels;
      if (!Array.isArray(labels) || labels.length < DIAGRAM_LABELS.min || labels.length > DIAGRAM_LABELS.max) {
        errors.push(`${where}: diagram props.labels must have ${DIAGRAM_LABELS.min}~${DIAGRAM_LABELS.max} items`);
      } else {
        for (const label of labels) {
          if (typeof label !== "string" || !label.trim() || [...label].length > DIAGRAM_LABELS.maxChars) {
            errors.push(`${where}: diagram label "${String(label)}" must be 1~${DIAGRAM_LABELS.maxChars} characters`);
          }
        }
      }
      if (typeof scene.props?.heading !== "string" || !scene.props.heading.trim()) {
        errors.push(`${where}: diagram props.heading is required`);
      }
      continue;
    }
    if (!BAND_SCENE_TYPES.has(scene.type)) continue;

    const visual = scene.visual;
    if (!visual?.kind) {
      errors.push(`${where}: visual.kind is required`);
      continue;
    }
    if (visual.kind === "aiImage") {
      counts.aiImage++;
      if (!visual.prompt?.trim()) errors.push(`${where}: aiImage needs visual.prompt`);
      const banned = findBannedProps(visual.prompt ?? "");
      if (banned.length) {
        errors.push(`${where}: aiImage visual.prompt must not include paper, books, photos or anything with writing (found: ${banned.join(", ")})`);
      }
    } else if (visual.kind === "pexels") {
      if (!visual.query?.trim()) errors.push(`${where}: pexels needs visual.query`);
    } else if (visual.kind === "existingClip") {
      counts.existingClip++;
      if (!visual.clipId || !knownClipIds.includes(visual.clipId)) {
        errors.push(`${where}: existingClip clipId must be one of ${knownClipIds.join(", ")}`);
      }
    }
  }

  for (const key of Object.keys(VISUAL_LIMITS) as Array<keyof typeof VISUAL_LIMITS>) {
    const { min, max } = VISUAL_LIMITS[key];
    if (counts[key] < min || counts[key] > max) {
      errors.push(`${key} scenes: ${counts[key]} (must be ${min}~${max})`);
    }
  }
  return errors;
}

export interface FloorAssessment {
  met: boolean;
  aiImage: number;
  diagram: number;
  /** Scenes that were meant to be AI visuals but did not survive as one. */
  lost: string[];
}

/**
 * Post-render check for the 2기 completion floor (docs/2단계_설계.md §5.2.1): at least 2 aiImage
 * scenes actually rendered from Cloudflare with no fallback, and at least 1 diagram scene that
 * was not demoted. Falling short means "완주했으나 2기 목표 미충족" — never reported as done.
 */
export function assessAiVisualFloor(script: { scenes: IntentScene[] }): FloorAssessment {
  let aiImage = 0;
  let diagram = 0;
  const lost: string[] = [];
  for (const scene of script.scenes) {
    if (scene.type === "diagram") {
      diagram++;
      continue;
    }
    if (scene.visual?.kind !== "aiImage") continue;
    const source = scene.visual.source;
    if (source?.provider === "cloudflare-workers-ai" && !source.fallbackFrom && scene.visual.assetPath) {
      aiImage++;
    } else {
      lost.push(`${scene.id} (${source?.fallbackReason ?? "no AI image source"})`);
    }
  }
  return {
    met: aiImage >= VISUAL_LIMITS.aiImage.min && diagram >= VISUAL_LIMITS.diagram.min,
    aiImage,
    diagram,
    lost,
  };
}
