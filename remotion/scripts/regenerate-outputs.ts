#!/usr/bin/env node
// Regenerates metadata.txt + thumbnail.png for an already-rendered project,
// without re-invoking `remotion render` (the mp4/audio don't need to change —
// only the text/thumbnail generation logic did). Used to backfill episodes
// rendered before that logic existed or changed.
import fs from "node:fs";
import path from "node:path";
import { generateMetadataDraft } from "./lib/metadataDraft";
import { computeThumbnailSeekMs, extractThumbnail } from "./lib/thumbnail";
import { PROJECTS_DIR } from "./lib/paths";

function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: npx tsx scripts/regenerate-outputs.ts <projectId>");
    process.exit(1);
  }

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));

  const outputDir = path.join(PROJECTS_DIR, projectId, "output");
  const videoPath = path.join(outputDir, `${projectId}.mp4`);
  if (!fs.existsSync(videoPath)) {
    console.error(`영상 파일 없음: ${videoPath} (먼저 render.ts로 렌더할 것)`);
    process.exit(1);
  }

  const draft = generateMetadataDraft(script);
  fs.writeFileSync(path.join(outputDir, `${projectId}.metadata.txt`), draft);
  console.log(`메타데이터 재생성: ${projectId}.metadata.txt`);

  const seekMs = computeThumbnailSeekMs(script);
  extractThumbnail(videoPath, seekMs, path.join(outputDir, `${projectId}.thumbnail.png`));
  console.log(`썸네일 재생성: ${projectId}.thumbnail.png (${(seekMs / 1000).toFixed(1)}s 지점)`);
}

main();
