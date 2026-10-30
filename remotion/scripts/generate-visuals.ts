#!/usr/bin/env node
import { generateVisuals } from "./lib/visualProviders/generateVisuals";

/**
 * Fills `visual.assetPath` + `visual.source` for every scene that declares `visual.kind`
 * (pexels | aiImage | existingClip | motion), with the automatic fallback chain from
 * docs/2단계_설계.md §5.2. Scenes without `visual.kind` (001~007) are left alone.
 *
 * Usage: npx tsx scripts/generate-visuals.ts <projectId> [sceneId ...]
 */
async function main() {
  const [projectId, ...sceneIds] = process.argv.slice(2);
  if (!projectId) {
    console.error("Usage: npx tsx scripts/generate-visuals.ts <projectId> [sceneId ...]");
    process.exit(1);
  }
  const events = await generateVisuals(projectId, { sceneIds: sceneIds.length > 0 ? sceneIds : undefined });
  console.log(events.length === 0 ? "No fallbacks." : `Fallbacks:\n${events.map((e) => `- ${e.sceneId}: ${e.from} → ${e.to} (${e.reason})`).join("\n")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
