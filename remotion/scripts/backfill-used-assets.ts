#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { collectEpisodeAssets, creditPexelsIds, recordEpisode } from "./lib/assetLedger";
import { PROJECTS_DIR, PUBLIC_DIR } from "./lib/paths";

/**
 * One-off backfill of data/used_assets.json (anti-repetition device ②) from every published-era episode's (003~)
 * script.json and Pexels credit sidecars. Rejected episodes are included too — the point is to
 * stop the same picture from coming back. Re-running is safe (each episode is replaced).
 *
 * Usage: npx tsx scripts/backfill-used-assets.ts
 */
for (const id of fs.readdirSync(PROJECTS_DIR).filter((d) => /^\d{3}_/.test(d) && parseInt(d, 10) >= 3).sort()) {
  const scriptPath = path.join(PROJECTS_DIR, id, "script.json");
  if (!fs.existsSync(scriptPath)) continue;
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const assets = collectEpisodeAssets(script, creditPexelsIds(path.join(PUBLIC_DIR, "projects", id, "videos")));
  recordEpisode(id, assets);
  console.log(`${id}: aiImage ${assets.aiImagePrompts.length}, existingClip ${assets.existingClips.length}, pexels ${assets.pexelsIds.length}, 3D ${assets.diagramKinds.length}`);
}
