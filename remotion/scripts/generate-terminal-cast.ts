#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildTerminalCastFromCommands } from "./lib/buildTerminalCast";
import { buildGuardedCast, resolveCastCommands } from "./lib/castCommands";
import { PROJECTS_DIR } from "./lib/paths";

/**
 * Builds a cast (see remotion/src/lib/cast.ts) for a single scene from real,
 * non-interactively captured command output, and writes it into that
 * scene's `props.cast` in script.json. No TTY, no screen capture — see
 * docs/remotion_트레이드오프_claudecode인계.md 항목 15.
 *
 * Usage: npx tsx scripts/generate-terminal-cast.ts <projectId> <sceneId>
 *
 * Commands come from the scene's `props.commands` (2기 episodes, checked by
 * lib/castCommandPolicy.ts — read-only repo introspection only) or, for
 * 002~007, from the legacy SCENE_COMMANDS table in lib/castCommands.ts.
 */
async function main() {
  const [projectId, sceneId] = process.argv.slice(2);
  if (!projectId || !sceneId) {
    console.error("Usage: npx tsx scripts/generate-terminal-cast.ts <projectId> <sceneId>");
    process.exit(1);
  }

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const scene = script.scenes.find((s: { id: string }) => s.id === sceneId);
  if (!scene) {
    console.error(`Scene "${sceneId}" not found in ${scriptPath}.`);
    process.exit(1);
  }

  const resolved = resolveCastCommands(projectId, scene);
  if (!resolved) {
    console.error(`No commands for ${projectId}/${sceneId} (neither props.commands nor SCENE_COMMANDS).`);
    process.exit(1);
  }
  for (const r of resolved.rejected) {
    console.warn(`Rejected by policy: ${r.display} — ${r.reason}`);
  }

  console.log(`Running ${resolved.commands.length} real command(s) for ${projectId}/${sceneId} (${resolved.source})...`);
  const dims = { width: 100, height: 30 };
  let cast;
  if (resolved.source === "legacy") {
    cast = buildTerminalCastFromCommands(resolved.commands, dims);
  } else {
    const guarded = buildGuardedCast(resolved.commands, dims);
    for (const s of guarded.skipped) console.warn(`Skipped: ${s.display} — ${s.reason}`);
    cast = guarded.cast;
  }

  if (!cast) {
    console.warn(`No command produced output; ${sceneId} keeps its static props.code.`);
    return;
  }
  scene.props = { ...scene.props, cast };
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  console.log(`Wrote cast (${cast.events.length} events) into ${sceneId}.props.cast in ${scriptPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
