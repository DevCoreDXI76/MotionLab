#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./lib/loadEnv";
import { searchPortraitVideo } from "./lib/pexels";
import { PROJECTS_DIR, PUBLIC_DIR } from "./lib/paths";

/**
 * Downloads a free Pexels stock video (portrait, license needs no
 * attribution but we credit it anyway — see scripts/lib/pexels.ts) and
 * wires it into a scene's `visual.assetPath`, reusing the same
 * image/video CentralVisual pipeline built for the Studio recording (see
 * src/components/VideoBackground.tsx) — no separate "broll" code path.
 *
 * Usage: npx tsx scripts/generate-broll.ts <projectId> <sceneId> "<query>"
 */
async function main() {
  loadEnv();
  const [projectId, sceneId, query] = process.argv.slice(2);
  if (!projectId || !sceneId || !query) {
    console.error('Usage: npx tsx scripts/generate-broll.ts <projectId> <sceneId> "<query>"');
    process.exit(1);
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.error("PEXELS_API_KEY not set (checked process.env and remotion/.env).");
    process.exit(1);
  }

  console.log(`Searching Pexels for "${query}" (portrait)...`);
  const result = await searchPortraitVideo(query, apiKey);
  if (!result) {
    console.error(`No portrait mp4 result found for "${query}".`);
    process.exit(1);
  }
  console.log(`Found ${result.width}x${result.height} clip by ${result.photographer} (${result.pageUrl})`);

  const videosDir = path.join(PUBLIC_DIR, "projects", projectId, "videos");
  fs.mkdirSync(videosDir, { recursive: true });
  const filename = `${sceneId}-broll.mp4`;
  const outPath = path.join(videosDir, filename);

  const videoResponse = await fetch(result.downloadUrl);
  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Failed to download clip: HTTP ${videoResponse.status}`);
  }
  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  console.log(`Downloaded ${(buffer.length / 1024).toFixed(0)} KB -> ${outPath}`);

  // Attribution sidecar — not required by Pexels' license, but we told them
  // we'd credit clips in the video description when requesting the API key.
  const creditPath = path.join(videosDir, `${sceneId}-broll.credit.json`);
  fs.writeFileSync(
    creditPath,
    JSON.stringify({ photographer: result.photographer, pexelsUrl: result.pageUrl, query }, null, 2),
  );

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const scene = script.scenes.find((s: { id: string }) => s.id === sceneId);
  if (!scene) {
    console.error(`Scene "${sceneId}" not found in ${scriptPath}.`);
    process.exit(1);
  }
  scene.visual = { ...scene.visual, assetPath: `projects/${projectId}/videos/${filename}` };
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  console.log(`Wired ${sceneId}.visual.assetPath in ${scriptPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
