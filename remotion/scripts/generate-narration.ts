#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { injectDurations } from "./lib/injectDurations";
import { EdgeTtsProvider } from "./lib/ttsProviders/edgeTtsProvider";
import { validateScript } from "./lib/scriptSchema";
import { loadLexicon } from "./lib/pronunciationLexicon";
import { PROJECTS_DIR, PUBLIC_DIR } from "./lib/paths";

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: npx tsx scripts/generate-narration.ts <projectId>");
    process.exit(1);
  }

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const raw = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const { valid, errors } = validateScript(raw);
  if (!valid) {
    console.error("script.json is invalid:\n" + errors.join("\n"));
    process.exit(1);
  }

  const audioOutDir = path.join(PUBLIC_DIR, "projects", projectId, "audio");
  const provider = new EdgeTtsProvider();
  try {
    const updated = await injectDurations(raw, provider, audioOutDir, `projects/${projectId}/audio`, loadLexicon());
    fs.writeFileSync(scriptPath, JSON.stringify(updated, null, 2));
    console.log(`Updated ${scriptPath} with ${updated.scenes.length} scene durations.`);
  } finally {
    provider.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
