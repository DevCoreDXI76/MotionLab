import { VISUAL_LIMITS } from "../visualIntent";
import type { SceneVisual } from "../visualProviders/types";

interface Scene {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  visual?: SceneVisual | null;
}

/** Fields the pipeline owns, whatever the model wrote (2기 is shorts-only, 1080x1920 @30fps). */
export function normalizeGeneratedScript<T extends { scenes: Scene[] }>(script: T, projectId: string): T {
  return { ...script, id: projectId, format: "shorts", fps: 30, width: 1080, height: 1920 };
}

/**
 * Over-cap visual kinds are demoted in code rather than regenerating the whole script
 * (docs/2단계_설계.md §5.2): extra aiImage → pexels (query) or motion, extra existingClip → pexels.
 * Under-floor counts are left alone — validateVisualIntent catches them and the script is regenerated.
 */
export function demoteOverCapVisuals<T extends { scenes: Scene[] }>(script: T): { script: T; demoted: string[] } {
  const seen = { aiImage: 0, existingClip: 0 };
  const demoted: string[] = [];
  const scenes = script.scenes.map((scene) => {
    const kind = scene.visual?.kind;
    if (kind !== "aiImage" && kind !== "existingClip") return scene;
    seen[kind]++;
    if (seen[kind] <= VISUAL_LIMITS[kind].max) return scene;
    const to = scene.visual?.query?.trim() ? "pexels" : "motion";
    demoted.push(`${scene.id}: ${kind} → ${to} (상한 ${VISUAL_LIMITS[kind].max} 초과)`);
    return { ...scene, visual: { ...scene.visual, kind: to } as SceneVisual };
  });
  return { script: { ...script, scenes }, demoted };
}

/**
 * Last-resort fallback when the 3D render keeps failing (§5.2): the diagram scene becomes a plain
 * talkingPoint with a code-drawn motion graphic. The scene then no longer counts toward the
 * AI-visual floor, so the run is honestly reported as missing it.
 */
export function demoteDiagramScenes<T extends { scenes: Scene[] }>(script: T): { script: T; demoted: string[] } {
  const demoted: string[] = [];
  const scenes = script.scenes.map((scene) => {
    if (scene.type !== "diagram") return scene;
    demoted.push(`${scene.id}: diagram → talkingPoint+motion (3D 렌더 실패)`);
    const labels = Array.isArray(scene.props?.labels) ? (scene.props.labels as string[]) : [];
    return {
      ...scene,
      type: "talkingPoint",
      props: { heading: String(scene.props?.heading ?? ""), bullets: labels.slice(0, 3) },
      visual: { kind: "motion", cue: "pipeline", assetPath: null, source: { provider: "motion", generatedAt: new Date().toISOString(), fallbackReason: "3D render failed" } } as SceneVisual,
    };
  });
  return { script: { ...script, scenes }, demoted };
}
