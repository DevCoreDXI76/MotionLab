#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnCli } from "./lib/spawnCli";
import { validateScript } from "./lib/scriptSchema";
import { generateMetadataDraft } from "./lib/metadataDraft";
import { assertFfmpegAvailable, normalizeLoudness } from "./lib/audio/loudnorm";
import { PROJECTS_DIR, REMOTION_DIR, PUBLIC_DIR } from "./lib/paths";

function assertDurationsFilled(script: {
  scenes: Array<{ id: string; durationMs?: number | null; audioPath?: string | null }>;
}) {
  const missingDuration = script.scenes.filter((s) => s.durationMs == null);
  if (missingDuration.length > 0) {
    throw new Error(
      `Missing durationMs for scenes: ${missingDuration.map((s) => s.id).join(", ")}. Run generate-narration first.`,
    );
  }

  const missingAudioPath = script.scenes.filter((s) => !s.audioPath);
  if (missingAudioPath.length > 0) {
    throw new Error(
      `Missing audioPath for scenes: ${missingAudioPath.map((s) => s.id).join(", ")}. Run generate-narration first.`,
    );
  }

  const missingAudioFile = script.scenes.filter((s) => !fs.existsSync(path.join(PUBLIC_DIR, s.audioPath as string)));
  if (missingAudioFile.length > 0) {
    throw new Error(
      `Audio file(s) not found on disk for scenes: ${missingAudioFile.map((s) => s.id).join(", ")}. ` +
        `Expected under ${PUBLIC_DIR}. Run generate-narration first.`,
    );
  }
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: npx tsx scripts/render.ts <projectId>");
    process.exit(1);
  }

  assertFfmpegAvailable();

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const { valid, errors } = validateScript(script);
  if (!valid) {
    console.error("script.json is invalid:\n" + errors.join("\n"));
    process.exit(1);
  }
  assertDurationsFilled(script);

  const outputDir = path.join(PROJECTS_DIR, projectId, "output");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${projectId}.mp4`);

  const npxArgs = ["remotion", "render", "src/index.ts", "Episode", outputPath, `--props=${scriptPath}`];
  const result = spawnCli("npx", npxArgs, { cwd: REMOTION_DIR, stdio: "inherit" });

  if (result.status !== 0) {
    console.error("remotion render failed.");
    process.exit(result.status ?? 1);
  }

  normalizeLoudness(outputPath);

  const draft = generateMetadataDraft(script);
  fs.writeFileSync(path.join(outputDir, `${projectId}.metadata.txt`), draft);
  console.log(`Rendered ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
