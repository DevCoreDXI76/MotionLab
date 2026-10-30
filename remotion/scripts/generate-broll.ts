#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fetchPexelsBroll, readPexelsApiKey } from "./lib/visualProviders/pexels";
import { PROJECTS_DIR } from "./lib/paths";

/**
 * Downloads a free Pexels stock video (portrait, license needs no
 * attribution but we credit it anyway — see scripts/lib/pexels.ts) and
 * wires it into a scene's `visual.assetPath`, reusing the same
 * image/video CentralVisual pipeline built for the Studio recording (see
 * src/components/VideoBackground.tsx) — no separate "broll" code path.
 * The search itself lives in lib/visualProviders/pexels.ts, shared with
 * generate-visuals.ts.
 *
 * Usage: npx tsx scripts/generate-broll.ts <projectId> <sceneId> "<query>" [--allow-face]
 *
 * --allow-face opts out of the 005 policy default (docs/remotion_사이드트랙_프로젝트설정.md)
 * that rejects face-closeup candidates in favor of hand/screen closeups — use it only when a
 * scene intentionally wants a face shot.
 */
async function main() {
  const rawArgs = process.argv.slice(2);
  const allowFaceCloseup = rawArgs.includes("--allow-face");
  const [projectId, sceneId, query] = rawArgs.filter((a) => a !== "--allow-face");
  if (!projectId || !sceneId || !query) {
    console.error('Usage: npx tsx scripts/generate-broll.ts <projectId> <sceneId> "<query>" [--allow-face]');
    process.exit(1);
  }

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const scene = script.scenes.find((s: { id: string }) => s.id === sceneId);
  if (!scene) {
    console.error(`Scene "${sceneId}" not found in ${scriptPath}.`);
    process.exit(1);
  }

  const ctx = { projectId, sceneId, sceneType: scene.type, log: (m: string) => console.log(m) };
  const result = await fetchPexelsBroll(ctx, query, readPexelsApiKey(), { allowFaceCloseup });
  if (!result) {
    process.exit(1);
  }

  scene.visual = { ...scene.visual, assetPath: result.assetPath, source: result.source };
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  console.log(`Wired ${sceneId}.visual.assetPath in ${scriptPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
