import { maskSecrets } from "../secrets";
import { generateAiImage } from "./aiImage";
import { prepareExistingClip } from "./existingClip";
import { fetchPexelsBroll, readPexelsApiKey } from "./pexels";
import type { ProviderContext, ProviderResult, SceneVisual, VisualKind } from "./types";

// Used when a scene has no query of its own (aiImage/existingClip falling back, or every authored
// query failing). Hand/screen closeups only — 005 visual policy.
export const DEFAULT_PEXELS_QUERY: Record<string, string> = {
  title: "hands typing on laptop keyboard close up",
  talkingPoint: "hands typing code on laptop close up",
  outro: "laptop screen glowing in dark room close up",
};
const DEFAULT_PEXELS_QUERY_FALLBACK = "hands on laptop keyboard close up";

export function pexelsQueryVariants(query: string | null | undefined, sceneType: string): string[] {
  const variants: string[] = [];
  const trimmed = query?.trim();
  if (trimmed) {
    variants.push(trimmed);
    const words = trimmed.split(/\s+/);
    if (words.length >= 3) variants.push(words.slice(0, -1).join(" "));
  }
  variants.push(DEFAULT_PEXELS_QUERY[sceneType] ?? DEFAULT_PEXELS_QUERY_FALLBACK);
  return [...new Set(variants)];
}

export interface FallbackEvent {
  sceneId: string;
  from: VisualKind;
  to: VisualKind;
  reason: string;
}

export interface ResolveDeps {
  aiImage: (ctx: ProviderContext, prompt: string) => Promise<ProviderResult>;
  pexels: (ctx: ProviderContext, query: string) => Promise<ProviderResult | null>;
  existingClip: (ctx: ProviderContext, clipId: string) => ProviderResult | null;
}

export const defaultDeps: ResolveDeps = {
  aiImage: (ctx, prompt) => generateAiImage(ctx, prompt),
  pexels: (ctx, query) => fetchPexelsBroll(ctx, query, readPexelsApiKey()),
  existingClip: prepareExistingClip,
};

function errorMessage(err: unknown): string {
  return maskSecrets(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
}

/**
 * Runs the scene's intended visual provider and walks the fallback chain on failure
 * (docs/2단계_설계.md §5.2): aiImage → pexels → motion, existingClip → pexels → motion,
 * pexels (query variants) → motion. Never waits for a human and never takes a paid path.
 * Scenes without `visual.kind` (001~007) are returned untouched.
 */
export async function resolveSceneVisual(
  scene: { id: string; type: string; visual?: SceneVisual | null },
  ctx: ProviderContext,
  deps: ResolveDeps = defaultDeps,
): Promise<{ visual: SceneVisual | null; events: FallbackEvent[] }> {
  const visual = scene.visual ?? null;
  const kind = visual?.kind;
  if (!visual || !kind) return { visual, events: [] };

  const events: FallbackEvent[] = [];
  const done = (result: ProviderResult, fallbackFrom: VisualKind | null, fallbackReason: string | null) => ({
    visual: {
      ...visual,
      assetPath: result.assetPath,
      source: { ...result.source, fallbackFrom, fallbackReason },
    },
    events,
  });

  let failedKind: VisualKind | null = null;
  let failReason: string | null = null;
  const fail = (from: VisualKind, to: VisualKind, reason: string) => {
    events.push({ sceneId: scene.id, from, to, reason });
    ctx.log(`fallback ${scene.id}: ${from} → ${to} (${reason})`);
    failedKind ??= from;
    failReason ??= reason;
  };

  if (kind === "aiImage") {
    try {
      return done(await deps.aiImage(ctx, visual.prompt ?? ""), null, null);
    } catch (err) {
      fail("aiImage", "pexels", errorMessage(err));
    }
  } else if (kind === "existingClip") {
    try {
      const result = deps.existingClip(ctx, visual.clipId ?? "");
      if (result) return done(result, null, null);
      fail("existingClip", "pexels", `clip "${visual.clipId}" unavailable`);
    } catch (err) {
      fail("existingClip", "pexels", errorMessage(err));
    }
  }

  if (kind !== "motion") {
    let lastReason = "";
    for (const query of pexelsQueryVariants(visual.query, scene.type)) {
      try {
        const result = await deps.pexels(ctx, query);
        if (result) return done(result, failedKind, failReason);
        lastReason = "no result for any query variant";
      } catch (err) {
        lastReason = errorMessage(err);
        ctx.log(`pexels "${query}" failed: ${lastReason}`);
      }
    }
    fail("pexels", "motion", lastReason);
  }

  return done(
    { assetPath: null, source: { provider: "motion", selectedBy: "only-candidate", cue: visual.cue ?? null, generatedAt: new Date().toISOString() } },
    failedKind,
    failReason,
  );
}
