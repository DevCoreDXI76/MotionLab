#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildTerminalCastFromCommands } from "./lib/buildTerminalCast";
import { REMOTION_DIR, PROJECTS_DIR } from "./lib/paths";

/**
 * Builds a cast (see remotion/src/lib/cast.ts) for a single scene from real,
 * non-interactively captured command output, and writes it into that
 * scene's `props.cast` in script.json. No TTY, no screen capture — see
 * docs/remotion_트레이드오프_claudecode인계.md 항목 15.
 *
 * Usage: npx tsx scripts/generate-terminal-cast.ts <projectId> <sceneId>
 *
 * The command list per scene is defined here rather than in script.json:
 * it's tied to what's actually safe/real/side-effect-free to run (read-only
 * project introspection), which is an engineering concern, not authored
 * content.
 */

const SCENE_COMMANDS: Record<string, Record<string, Parameters<typeof buildTerminalCastFromCommands>[0]>> = {
  "002_test": {
    "scene-4-code": [
      { display: "git log --oneline -5", command: "git", args: ["log", "--oneline", "-5"], cwd: REMOTION_DIR },
      { display: "npx vitest run", command: "npx", args: ["vitest", "run"], cwd: REMOTION_DIR },
    ],
  },
};

async function main() {
  const [projectId, sceneId] = process.argv.slice(2);
  if (!projectId || !sceneId) {
    console.error("Usage: npx tsx scripts/generate-terminal-cast.ts <projectId> <sceneId>");
    process.exit(1);
  }

  const commands = SCENE_COMMANDS[projectId]?.[sceneId];
  if (!commands) {
    console.error(`No command list defined for ${projectId}/${sceneId} in SCENE_COMMANDS.`);
    process.exit(1);
  }

  console.log(`Running ${commands.length} real command(s) for ${projectId}/${sceneId}...`);
  const cast = buildTerminalCastFromCommands(commands, { width: 100, height: 30 });

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const scene = script.scenes.find((s: { id: string }) => s.id === sceneId);
  if (!scene) {
    console.error(`Scene "${sceneId}" not found in ${scriptPath}.`);
    process.exit(1);
  }
  scene.props = { ...scene.props, cast };
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  console.log(`Wrote cast (${cast.events.length} events) into ${sceneId}.props.cast in ${scriptPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
