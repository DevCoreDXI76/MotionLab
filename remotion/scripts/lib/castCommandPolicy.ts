import path from "node:path";
import type { CastCommand } from "./buildTerminalCast";

/**
 * Guard for terminal-cast commands authored in script.json (backlog 6). Those commands come from
 * the script generator — i.e. a model — and run on this machine, so only read-only introspection
 * of this repo is allowed (docs/2단계_설계.md §4 #6): an allowlist per executable, no shell, no
 * paths outside the repo, nothing that names secrets. Anything not explicitly allowed is rejected.
 */

export interface ScriptCastCommand {
  display: string;
  argv: string[];
  cwd: "root" | "remotion";
}

export type PolicyResult = { ok: true; command: CastCommand } | { ok: false; reason: string };

// Flags that take a value in the next argv slot, per executable.
const VALUE_FLAGS: Record<string, Set<string>> = {
  git: new Set(["-n"]),
  grep: new Set(["-A", "-B", "-C", "-m"]),
  head: new Set(["-n"]),
};

const ALLOWED_FLAGS: Record<string, Set<string>> = {
  git: new Set(["--oneline", "--stat", "--shortstat", "--name-only", "--no-color", "--short", "-n", "-1", "-3", "-5", "-10"]),
  grep: new Set(["-n", "-c", "-l", "-i", "-E", "-F", "-w", "-v", "-o", "-A", "-B", "-C", "-m"]),
  head: new Set(["-n"]),
  wc: new Set(["-l", "-w", "-c"]),
  ls: new Set(["-1", "-l"]),
  cat: new Set(),
};

const GIT_SUBCOMMANDS = new Set(["log", "show", "diff", "status"]);

// Substrings that must never appear in any argument (case-insensitive) — keeps the command away
// from key material even via indirect forms like `git show HEAD:secrets/x` or `../.env`.
const BLOCKED_SUBSTRINGS = ["secret", ".env", "token", "credential", "password", ".ssh", ".git/", "id_rsa"];

function argProblem(arg: string): string | null {
  if (arg.length === 0) return "empty argument";
  if (/[\0\r\n]/.test(arg)) return "control character in argument";
  const lower = arg.toLowerCase();
  const blocked = BLOCKED_SUBSTRINGS.find((s) => lower.includes(s));
  if (blocked) return `argument mentions blocked path/word "${blocked}"`;
  if (/^([A-Za-z]:|[\\/]|~)/.test(arg)) return "absolute or home path";
  if (arg.split(/[\\/]/).includes("..")) return "parent-directory path";
  if (/[|&;<>`$]/.test(arg)) return "shell metacharacter";
  return null;
}

/** Validates flags/positionals for `exe` from argv index `start`. */
function flagsProblem(exe: string, args: string[]): string | null {
  const allowed = ALLOWED_FLAGS[exe];
  const valueFlags = VALUE_FLAGS[exe] ?? new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-")) continue;
    if (!allowed.has(arg)) return `flag "${arg}" not allowed for ${exe}`;
    if (valueFlags.has(arg)) {
      const value = args[i + 1];
      if (value === undefined || !/^\d{1,3}$/.test(value)) return `flag "${arg}" needs a small number`;
      i++;
    }
  }
  return null;
}

/** How argv is shown typed in the terminal: arguments containing spaces are double-quoted. */
export function displayFor(argv: string[]): string {
  return argv.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
}

export function validateCastCommand(
  cmd: ScriptCastCommand,
  dirs: { root: string; remotion: string },
): PolicyResult {
  if (!cmd || typeof cmd.display !== "string" || !Array.isArray(cmd.argv) || cmd.argv.length === 0) {
    return { ok: false, reason: "malformed command (needs display, argv[], cwd)" };
  }
  if (cmd.cwd !== "root" && cmd.cwd !== "remotion") {
    return { ok: false, reason: `cwd must be "root" or "remotion"` };
  }
  if (!cmd.argv.every((a) => typeof a === "string")) {
    return { ok: false, reason: "argv must be strings" };
  }
  for (const arg of cmd.argv) {
    const problem = argProblem(arg);
    if (problem) return { ok: false, reason: problem };
  }
  // The displayed line must be the command that actually runs — no showing one thing and running another.
  if (cmd.display.trim() !== displayFor(cmd.argv)) {
    return { ok: false, reason: `display must equal the argv it runs: ${displayFor(cmd.argv)}` };
  }

  const [exe, ...args] = cmd.argv;
  if (exe === "git") {
    const [sub, ...rest] = args;
    if (!GIT_SUBCOMMANDS.has(sub)) return { ok: false, reason: `git subcommand "${sub}" not allowed` };
    const problem = flagsProblem("git", rest);
    if (problem) return { ok: false, reason: problem };
  } else if (exe === "npx") {
    const [tool, sub, ...rest] = args;
    if (tool !== "vitest" || sub !== "run") return { ok: false, reason: "npx only allows `npx vitest run <test files>`" };
    if (rest.some((a) => a.startsWith("-"))) return { ok: false, reason: "npx vitest run takes test file paths only" };
  } else if (exe in ALLOWED_FLAGS) {
    const problem = flagsProblem(exe, args);
    if (problem) return { ok: false, reason: problem };
  } else {
    return { ok: false, reason: `executable "${exe}" not allowed` };
  }

  const cwd = cmd.cwd === "root" ? dirs.root : dirs.remotion;
  if (!path.resolve(cwd).startsWith(path.resolve(dirs.root))) {
    return { ok: false, reason: "cwd outside the repository" };
  }
  return { ok: true, command: { display: cmd.display.trim(), command: exe, args, cwd } };
}
