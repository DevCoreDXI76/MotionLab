import { spawnSync } from "node:child_process";

export interface CliSpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface SpawnCliOptions {
  cwd?: string;
  stdio?: "inherit" | "pipe";
  /**
   * Environment variable names to delete from the child process's env before
   * spawning. Used e.g. to strip billing-redirect vars (ANTHROPIC_API_KEY,
   * ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, CLAUDE_CODE_USE_BEDROCK,
   * CLAUDE_CODE_USE_VERTEX) so the `claude` CLI can't be silently redirected
   * off the interactive Max-plan subscription and onto metered API/third-party
   * billing if any of them happen to be set in the ambient shell.
   */
  extraEnvStrip?: string[];
}

/**
 * Spawns an external CLI safely on both platforms, including CLIs that resolve
 * to a Windows .cmd/.bat shim (e.g. npm-installed global binaries).
 *
 * Strategy: always try a direct, shell-less spawn first (bare command name,
 * args as a plain array, no reinterpretation of the argument bytes at all).
 * This is the ONLY spawn mode that preserves an argument byte-for-byte,
 * including embedded newlines — which matters because e.g. `claude -p
 * "<multi-line prompt>"` passes a prompt built from a multi-line template.
 * Direct spawn resolves .exe/.com targets correctly; it fails cleanly with
 * ENOENT when the target is actually a .cmd/.bat shim (Windows CreateProcess
 * cannot launch a script file as an image).
 *
 * Only on that specific ENOENT (win32 only) do we fall back to routing
 * through `cmd.exe /d /s /c` with each argument as its own array element
 * (NOT shell:true — shell:true with an array of args does NOT escape
 * metacharacters for cmd.exe, it just concatenates them; that's Node's
 * DEP0190 warning, and we verified it does not protect embedded newlines
 * either). The cmd.exe fallback is necessary to run .cmd/.bat shims at all,
 * but note it is NOT newline-safe: cmd.exe's command-line parser is
 * line-oriented and truncates an argument at the first embedded \n
 * regardless of quoting (verified empirically). This is an acceptable
 * trade-off because the only args routed through this fallback in this
 * codebase (npx render args) are plain file paths/flags with no embedded
 * newlines; a future .cmd-shimmed CLI invoked with multi-line arguments
 * would need a different mechanism (e.g. stdin) rather than this fallback.
 *
 * Verified against both a native .exe (claude) and an npm .cmd shim (npx)
 * on Node v24 / Windows 11, including a real multi-line prompt round-trip.
 *
 * Throws when the spawn itself fails (ENOENT that isn't resolved by the
 * cmd.exe fallback, or any other spawn error such as EINVAL — the process
 * never started), with the underlying error message surfaced, instead of
 * silently returning `status: null` with no diagnostic. Callers only need to
 * check `status` for the "process ran but exited non-zero" case.
 */
export function spawnCli(command: string, args: string[], options: SpawnCliOptions = {}): CliSpawnResult {
  const env = { ...process.env };
  for (const key of options.extraEnvStrip ?? []) {
    delete env[key];
  }

  const spawnOptions = {
    cwd: options.cwd,
    stdio: options.stdio ?? "inherit",
    env,
    encoding: "utf-8" as const,
  };

  const direct = spawnSync(command, args, spawnOptions);

  const isWin = process.platform === "win32";
  const directFailedToLaunch = direct.error != null;
  const shouldFallBackToCmd = isWin && directFailedToLaunch && (direct.error as NodeJS.ErrnoException).code === "ENOENT";

  const result = shouldFallBackToCmd
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", command, ...args], spawnOptions)
    : direct;

  if (result.error) {
    throw new Error(`Failed to spawn "${command}": ${result.error.message}`);
  }

  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
