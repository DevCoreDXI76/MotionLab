export const VISUAL_KINDS = ["pexels", "aiImage", "existingClip", "motion"] as const;
export type VisualKind = (typeof VISUAL_KINDS)[number];

/**
 * Where a scene's visual actually came from (docs/2단계_설계.md §2.1, backlog 1). Written by
 * providers, never by the script generator. Provider-specific fields ride along loosely.
 */
export interface VisualSource {
  provider: "pexels" | "cloudflare-workers-ai" | "existing-clip" | "motion";
  selectedBy?: "auto-vision" | "auto-rule" | "fallback" | "only-candidate";
  /** Set when this provider ran because the scene's intended kind failed (e.g. "aiImage"). */
  fallbackFrom?: VisualKind | null;
  fallbackReason?: string | null;
  generatedAt: string;
  [key: string]: unknown;
}

/** script.json scene.visual — authored intent (kind/query/prompt/clipId) plus render inputs and source. */
export interface SceneVisual {
  cue?: string | null;
  assetPath?: string | null;
  focal?: "center" | "top" | "bottom" | "left" | "right";
  kind?: VisualKind;
  query?: string | null;
  prompt?: string | null;
  clipId?: string | null;
  source?: VisualSource | null;
}

export interface ProviderResult {
  /** public/-relative path the renderer reads; null for code-drawn visuals (motion). */
  assetPath: string | null;
  source: VisualSource;
}

export interface ProviderContext {
  projectId: string;
  sceneId: string;
  sceneType: string;
  log: (message: string) => void;
}
