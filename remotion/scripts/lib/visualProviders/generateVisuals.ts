import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR } from "../paths";
import { defaultDeps, resolveSceneVisual } from "./resolveVisual";
import type { FallbackEvent, ResolveDeps } from "./resolveVisual";
import type { SceneVisual } from "./types";

/**
 * Resolves every scene that declares `visual.kind` in projects/<id>/script.json, writing the file
 * back after each scene so a crash mid-way keeps what already succeeded. Returns all fallbacks
 * taken (the orchestrator logs them as automatic fallbacks, not human interventions).
 */
export async function generateVisuals(
  projectId: string,
  options: { deps?: ResolveDeps; sceneIds?: string[]; log?: (m: string) => void } = {},
): Promise<FallbackEvent[]> {
  const log = options.log ?? ((m: string) => console.log(m));
  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as {
    scenes: Array<{ id: string; type: string; visual?: SceneVisual | null }>;
  };

  const events: FallbackEvent[] = [];
  for (const scene of script.scenes) {
    if (!scene.visual?.kind) continue;
    if (options.sceneIds && !options.sceneIds.includes(scene.id)) continue;
    log(`[visual] ${scene.id}: ${scene.visual.kind}`);
    const ctx = { projectId, sceneId: scene.id, sceneType: scene.type, log: (m: string) => log(`  ${m}`) };
    const result = await resolveSceneVisual(scene, ctx, options.deps ?? defaultDeps);
    scene.visual = result.visual;
    events.push(...result.events);
    fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  }
  return events;
}
