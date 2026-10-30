import { spawnCli } from "./spawnCli";
import { buildCast } from "../../src/lib/cast";
import type { Cast, CastSegment } from "../../src/lib/cast";
import type { CastCommand } from "./buildTerminalCast";
import { validateCastCommand } from "./castCommandPolicy";
import type { ScriptCastCommand } from "./castCommandPolicy";
import { maskSecrets } from "./secrets";
import { REMOTION_DIR, ROOT_DIR } from "./paths";

// 002~007 command lists, from before commands moved into script.json (backlog 6). Kept verbatim so
// re-running generate-terminal-cast for those episodes behaves exactly as before; new episodes put
// commands in the code scene's `props.commands` instead.
export const SCENE_COMMANDS: Record<string, Record<string, CastCommand[]>> = {
  "002_test": {
    "scene-4-code": [
      { display: "git log --oneline -5", command: "git", args: ["log", "--oneline", "-5"], cwd: REMOTION_DIR },
      { display: "npx vitest run", command: "npx", args: ["vitest", "run"], cwd: REMOTION_DIR },
    ],
  },
  "003_pipeline": {
    "scene-3-script": [
      {
        display: "head -n 15 projects/003_pipeline/script.json",
        command: "head",
        args: ["-n", "15", "projects/003_pipeline/script.json"],
        cwd: ROOT_DIR,
      },
      { display: "npx vitest run", command: "npx", args: ["vitest", "run"], cwd: REMOTION_DIR },
    ],
  },
  "004_failures": {
    "scene-3-fix": [
      { display: "git log --oneline -5", command: "git", args: ["log", "--oneline", "-5"], cwd: REMOTION_DIR },
      {
        display: "grep -n gdigrab docs/remotion_트레이드오프_claudecode인계.md",
        command: "grep",
        args: ["-n", "gdigrab", "docs/remotion_트레이드오프_claudecode인계.md"],
        cwd: ROOT_DIR,
      },
    ],
  },
  "005_casting": {
    "scene-3-diagnose": [
      {
        display: "grep -n -A 2 'process.argv.slice' remotion/scripts/generate-broll.ts",
        command: "grep",
        args: ["-n", "-A", "2", "process.argv.slice", "remotion/scripts/generate-broll.ts"],
        cwd: ROOT_DIR,
      },
      {
        display: "grep -n 005부터\\ 적용 docs/002_test_리뷰_개선백로그.md",
        command: "grep",
        args: ["-n", "005부터 적용", "docs/002_test_리뷰_개선백로그.md"],
        cwd: ROOT_DIR,
      },
    ],
  },
  "006_recap": {
    "scene-3-log": [
      {
        display: 'grep -l "막힌 지점" projects/003_pipeline/log.md projects/004_failures/log.md projects/005_casting/log.md',
        command: "grep",
        args: [
          "-l",
          "막힌 지점",
          "projects/003_pipeline/log.md",
          "projects/004_failures/log.md",
          "projects/005_casting/log.md",
        ],
        cwd: ROOT_DIR,
      },
    ],
  },
  "007_resolution": {
    "scene-3-test": [
      {
        display: "npx vitest run scripts/lib/pexels.test.ts",
        command: "npx",
        args: ["vitest", "run", "scripts/lib/pexels.test.ts"],
        cwd: REMOTION_DIR,
      },
    ],
  },
};

const COMMAND_TIMEOUT_MS = 30_000;
const ATTEMPTS = 2;

export interface ResolvedCastCommands {
  source: "script" | "legacy";
  commands: CastCommand[];
  rejected: Array<{ display: string; reason: string }>;
}

/**
 * script.json `props.commands` wins (each one through the policy guard); otherwise the legacy
 * SCENE_COMMANDS entry; otherwise null.
 */
export function resolveCastCommands(
  projectId: string,
  scene: { id: string; props?: Record<string, unknown> },
  dirs = { root: ROOT_DIR, remotion: REMOTION_DIR },
): ResolvedCastCommands | null {
  const authored = scene.props?.commands;
  if (Array.isArray(authored)) {
    const commands: CastCommand[] = [];
    const rejected: ResolvedCastCommands["rejected"] = [];
    for (const raw of authored as ScriptCastCommand[]) {
      const result = validateCastCommand(raw, dirs);
      if (result.ok) commands.push(result.command);
      else rejected.push({ display: String(raw?.display ?? JSON.stringify(raw)), reason: result.reason });
    }
    return { source: "script", commands, rejected };
  }
  const legacy = SCENE_COMMANDS[projectId]?.[scene.id];
  return legacy ? { source: "legacy", commands: legacy, rejected: [] } : null;
}

export interface GuardedCastResult {
  cast: Cast | null;
  ran: string[];
  skipped: Array<{ display: string; reason: string }>;
}

/**
 * For script-authored commands: runs each one (30s timeout, one retry), skips failures instead of
 * aborting, and masks any secret value that shows up in output. Returns cast=null when nothing
 * ran — the code scene then shows its static `props.code`.
 */
export function buildGuardedCast(
  commands: CastCommand[],
  dims: { width: number; height: number },
  secretValues?: string[],
): GuardedCastResult {
  const segments: CastSegment[] = [];
  const ran: string[] = [];
  const skipped: GuardedCastResult["skipped"] = [];
  for (const cmd of commands) {
    let output: string | null = null;
    let reason = "";
    for (let attempt = 1; attempt <= ATTEMPTS && output === null; attempt++) {
      try {
        const result = spawnCli(cmd.command, cmd.args, { cwd: cmd.cwd, stdio: "pipe", timeoutMs: COMMAND_TIMEOUT_MS });
        if (result.status === 0) output = (result.stdout || result.stderr).trim();
        else reason = `exited ${result.status}`;
      } catch (err) {
        reason = (err as Error).message;
      }
    }
    if (output === null) {
      skipped.push({ display: cmd.display, reason: maskSecrets(reason, secretValues) });
      continue;
    }
    segments.push({ kind: "input", text: maskSecrets(cmd.display, secretValues) });
    if (output) segments.push({ kind: "output", text: maskSecrets(output, secretValues) });
    ran.push(cmd.display);
  }
  return { cast: segments.length > 0 ? buildCast(segments, dims) : null, ran, skipped };
}
