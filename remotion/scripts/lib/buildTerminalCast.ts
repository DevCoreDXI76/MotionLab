import type { Cast, CastSegment } from "../../src/lib/cast";
import { buildCast } from "../../src/lib/cast";
import { spawnCli } from "./spawnCli";

export interface CastCommand {
  /** How the command is displayed as "typed" in the terminal — may differ from the literal argv (e.g. shown with line-continuation formatting). */
  display: string;
  command: string;
  args: string[];
  cwd: string;
}

/**
 * Runs each real command non-interactively (spawnCli with stdio:"pipe" —
 * no TTY needed, see cast.ts) and turns the captured stdout/stderr into
 * cast segments: the command line as an "input" segment, its real output
 * as an "output" segment. Throws if a command exits non-zero — a cast
 * built from a failing command would misrepresent the pipeline as broken.
 */
export function buildTerminalCastFromCommands(commands: CastCommand[], dims: { width: number; height: number }): Cast {
  const segments: CastSegment[] = [];

  for (const cmd of commands) {
    const result = spawnCli(cmd.command, cmd.args, { cwd: cmd.cwd, stdio: "pipe" });
    if (result.status !== 0) {
      throw new Error(
        `buildTerminalCastFromCommands: "${cmd.display}" exited ${result.status}.\n${result.stderr || result.stdout}`,
      );
    }
    segments.push({ kind: "input", text: cmd.display });
    const output = (result.stdout || result.stderr).trim();
    if (output) {
      segments.push({ kind: "output", text: output });
    }
  }

  return buildCast(segments, dims);
}
