import { describe, expect, it } from "vitest";
import { displayFor, validateCastCommand } from "./castCommandPolicy";
import type { ScriptCastCommand } from "./castCommandPolicy";

const dirs = { root: "C:/repo", remotion: "C:/repo/remotion" };
const cmd = (argv: string[], cwd: ScriptCastCommand["cwd"] = "root"): ScriptCastCommand => ({ display: displayFor(argv), argv, cwd });
const reason = (c: ScriptCastCommand) => {
  const r = validateCastCommand(c, dirs);
  return r.ok ? "OK" : r.reason;
};

describe("validateCastCommand — allowed read-only introspection", () => {
  it.each([
    [["git", "log", "--oneline", "-5"]],
    [["git", "log", "-n", "3", "--stat"]],
    [["git", "show", "--stat", "HEAD"]],
    [["npx", "vitest", "run", "scripts/lib/pexels.test.ts"]],
    [["grep", "-n", "-A", "2", "pickBestFile", "remotion/scripts/lib/pexels.ts"]],
    [["grep", "-l", "막힌 지점", "projects/007_resolution/log.md"]],
    [["head", "-n", "15", "projects/007_resolution/script.json"]],
    [["wc", "-l", "docs/2단계_설계.md"]],
  ])("allows %j", (argv) => {
    expect(reason(cmd(argv))).toBe("OK");
  });

  it("maps cwd and keeps the displayed line identical to what runs", () => {
    const r = validateCastCommand(cmd(["npx", "vitest", "run", "a.test.ts"], "remotion"), dirs);
    expect(r).toEqual({ ok: true, command: { display: "npx vitest run a.test.ts", command: "npx", args: ["vitest", "run", "a.test.ts"], cwd: "C:/repo/remotion" } });
  });
});

describe("validateCastCommand — bypass attempts are rejected", () => {
  it.each([
    ["reading secrets directly", ["cat", "secrets/cloudflare_ai.txt"], /blocked path\/word "secret"/],
    ["secrets via parent dir", ["head", "-n", "5", "../secrets/pexels_api_key.txt"], /secret/],
    ["secrets via git object path", ["git", "show", "HEAD:secrets/youtube_token.json"], /secret/],
    ["case games", ["cat", "SECRETS/Pexels_Api_Key.txt"], /secret/],
    [".env file", ["cat", "remotion/.env"], /\.env/],
    ["token file by name", ["cat", "youtube_token.json"], /token/],
    ["absolute path", ["cat", "C:/Users/someone/notes.txt"], /absolute/],
    ["unix absolute path", ["head", "-n", "1", "/etc/passwd"], /absolute/],
    ["home path", ["cat", "~/.bashrc"], /absolute or home/],
    ["parent traversal", ["cat", "../outside.txt"], /parent-directory/],
    ["shell chaining in an argument", ["grep", "-n", "x;rm", "file.txt"], /shell metacharacter/],
    ["command substitution", ["grep", "$(whoami)", "file.txt"], /shell metacharacter/],
    ["newline injection", ["grep", "a\nb", "file.txt"], /control character/],
    ["arbitrary executable", ["powershell", "-c", "Get-ChildItem"], /not allowed/],
    ["node eval", ["node", "-e", "require('fs')"], /not allowed/],
    ["git write subcommand", ["git", "push", "origin", "master"], /subcommand "push"/],
    ["git config injection", ["git", "-c", "core.pager=calc", "log"], /subcommand "-c"/],
    ["git diff writing a file", ["git", "diff", "--output=out.txt"], /flag "--output=out.txt"/],
    ["git internals", ["cat", ".git/config"], /\.git\//],
    ["grep recursive sweep", ["grep", "-r", "KEY", "."], /flag "-r"/],
    ["grep patterns from file", ["grep", "-f", "patterns.txt", "file.txt"], /flag "-f"/],
    ["npx arbitrary package", ["npx", "some-package"], /npx only allows/],
    ["vitest with config flag", ["npx", "vitest", "run", "--config", "evil.ts"], /test file paths only/],
    ["non-numeric flag value", ["head", "-n", "all", "file.txt"], /small number/],
  ])("%s", (_label, argv, expected) => {
    expect(reason(cmd(argv as string[]))).toMatch(expected);
  });

  it("rejects a display that differs from what actually runs", () => {
    expect(reason({ display: "git log --oneline -5", argv: ["git", "show", "HEAD"], cwd: "root" })).toMatch(/display must equal/);
  });

  it("rejects an unknown cwd and malformed entries", () => {
    expect(reason({ ...cmd(["git", "status"]), cwd: "C:/" as "root" })).toMatch(/cwd must be/);
    expect(reason({ display: "x" } as ScriptCastCommand)).toMatch(/malformed/);
    expect(reason({ display: "x", argv: [1 as unknown as string], cwd: "root" })).toMatch(/argv must be strings/);
  });
});
