import { spawnSync } from "node:child_process";

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface CliRunner {
  run(args: string[]): CliResult;
}

export class ClaudeCliRunner implements CliRunner {
  run(args: string[]): CliResult {
    // ANTHROPIC_API_KEY가 설정돼 있으면 claude -p가 이를 우선 사용해 종량 과금으로 전환된다.
    // Max 플랜 구독 한도 안에서만 쓰도록 자식 프로세스 환경에서 명시적으로 제거한다.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    // "claude" resolves correctly without shell:true on both platforms: on win32,
    // Node's non-shell spawn already performs PATH/PATHEXT extension resolution for a
    // bare command name (finds claude.exe, or a claude.cmd npm shim, whichever is
    // installed) — passing an explicit ".cmd" suffix bypasses that search and fails
    // with EINVAL/status:null when the real binary isn't literally named claude.cmd.
    const result = spawnSync("claude", args, { encoding: "utf-8", env });
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  }
}
