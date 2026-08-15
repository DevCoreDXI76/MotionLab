#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { generateScript } from "./lib/claudeScriptGenerator";
import { ClaudeCliRunner } from "./lib/claudeCliRunner";
import { PROJECTS_DIR } from "./lib/paths";

function main() {
  const [projectId, topic, format = "shorts"] = process.argv.slice(2);
  if (!projectId || !topic) {
    console.error('Usage: npx tsx scripts/generate-script.ts <projectId> "<topic>" [shorts|long]');
    process.exit(1);
  }

  const script = generateScript(new ClaudeCliRunner(), topic, format as "shorts" | "long", projectId);

  const projectDir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  const outPath = path.join(projectDir, "script.json");
  fs.writeFileSync(outPath, JSON.stringify(script, null, 2));
  console.log(`Wrote ${outPath}`);
}

main();
