import { spawnCli } from "./spawnCli";

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface CliRunner {
  run(args: string[]): CliResult;
}

// Each of these env vars can redirect the `claude` CLI off the interactive
// Max-plan subscription and onto metered API/third-party billing if set in
// the ambient shell. This pipeline must never fall back to metered billing.
const BILLING_REDIRECT_ENV_VARS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
];

export class ClaudeCliRunner implements CliRunner {
  run(args: string[]): CliResult {
    return spawnCli("claude", args, {
      stdio: "pipe",
      extraEnvStrip: BILLING_REDIRECT_ENV_VARS,
    });
  }
}
