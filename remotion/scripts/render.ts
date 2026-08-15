#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateScript } from "./lib/scriptSchema";
import { generateMetadataDraft } from "./lib/metadataDraft";
import { PROJECTS_DIR, REMOTION_DIR } from "./lib/paths";

function assertDurationsFilled(script: { scenes: Array<{ id: string; durationMs?: number | null }> }) {
  const missing = script.scenes.filter((s) => s.durationMs == null);
  if (missing.length > 0) {
    throw new Error(
      `Missing durationMs for scenes: ${missing.map((s) => s.id).join(", ")}. Run generate-narration first.`,
    );
  }
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: npx tsx scripts/render.ts <projectId>");
    process.exit(1);
  }

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

  // npx resolves to npx.cmd on Windows; Node's CVE-2024-27980 fix requires shell: true
  // to invoke .cmd/.bat targets (bare "npx" without it fails with ENOENT, and an explicit
  // "npx.cmd" without it fails with EINVAL). Verified on Node v24.15.0 / Windows 11.
  const result = spawnSync(
    "npx",
    ["remotion", "render", "src/index.ts", "Episode", outputPath, `--props=${scriptPath}`],
    { cwd: REMOTION_DIR, stdio: "inherit", shell: true },
  );

  if (result.status !== 0) {
    console.error("remotion render failed.");
    process.exit(result.status ?? 1);
  }

  const draft = generateMetadataDraft(script);
  fs.writeFileSync(path.join(outputDir, `${projectId}.metadata.txt`), draft);
  console.log(`Rendered ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
