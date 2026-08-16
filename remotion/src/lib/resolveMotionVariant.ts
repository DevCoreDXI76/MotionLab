export type MotionVariant = "pipeline" | "terminal" | "checklist" | "pulse";

const KNOWN_VARIANTS: readonly MotionVariant[] = ["pipeline", "terminal", "checklist", "pulse"];

// Kept intentionally small (3-4 entries) — see CentralVisual design notes.
// Adding more should be a deliberate follow-up, not incidental scope creep.
const SCENE_TYPE_DEFAULTS: Record<string, MotionVariant> = {
  title: "terminal",
  talkingPoint: "checklist",
  outro: "pulse",
};

const DEFAULT_VARIANT: MotionVariant = "pipeline";

/**
 * Picks which code-based motion graphic to render in CentralVisual when no
 * `visual.assetPath` image is available. `cue` (from script.json's
 * `visual.cue`) wins when it names a known variant; otherwise falls back to
 * a per-scene-type default, and finally to a generic default.
 */
export function resolveMotionVariant(cue: string | null | undefined, sceneType: string): MotionVariant {
  if (cue && (KNOWN_VARIANTS as readonly string[]).includes(cue)) {
    return cue as MotionVariant;
  }
  return SCENE_TYPE_DEFAULTS[sceneType] ?? DEFAULT_VARIANT;
}
