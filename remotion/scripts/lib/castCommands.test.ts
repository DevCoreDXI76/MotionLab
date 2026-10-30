import { describe, expect, it } from "vitest";
import { buildGuardedCast, resolveCastCommands, SCENE_COMMANDS } from "./castCommands";
import { REMOTION_DIR } from "./paths";

describe("resolveCastCommands", () => {
  it("keeps 007's legacy command list (script.json for 002~007 is never rewritten)", () => {
    const resolved = resolveCastCommands("007_resolution", { id: "scene-3-test", props: { code: "x" } });
    expect(resolved).toEqual({ source: "legacy", commands: SCENE_COMMANDS["007_resolution"]["scene-3-test"], rejected: [] });
    expect(resolved?.commands[0]).toMatchObject({ display: "npx vitest run scripts/lib/pexels.test.ts", command: "npx", cwd: REMOTION_DIR });
  });

  it("covers every legacy episode that had a cast", () => {
    expect(Object.keys(SCENE_COMMANDS)).toEqual(["002_test", "003_pipeline", "004_failures", "005_casting", "006_recap", "007_resolution"]);
  });

  it("prefers props.commands and drops the ones the policy rejects", () => {
    const resolved = resolveCastCommands("008_x", {
      id: "scene-3",
      props: {
        commands: [
          { display: "git log --oneline -3", argv: ["git", "log", "--oneline", "-3"], cwd: "root" },
          { display: "cat secrets/cloudflare_ai.txt", argv: ["cat", "secrets/cloudflare_ai.txt"], cwd: "root" },
        ],
      },
    });
    expect(resolved?.source).toBe("script");
    expect(resolved?.commands.map((c) => c.display)).toEqual(["git log --oneline -3"]);
    expect(resolved?.rejected).toEqual([{ display: "cat secrets/cloudflare_ai.txt", reason: 'argument mentions blocked path/word "secret"' }]);
  });

  it("returns null when a scene has neither", () => {
    expect(resolveCastCommands("008_x", { id: "nope" })).toBeNull();
  });
});

describe("buildGuardedCast", () => {
  const node = (code: string) => ({ display: `node -e ${code}`, command: "node", args: ["-e", code], cwd: REMOTION_DIR });

  it("masks secret values in command output", () => {
    const { cast, ran } = buildGuardedCast([node("console.log('key=abcdef123456 ok')")], { width: 100, height: 30 }, ["abcdef123456"]);
    expect(ran).toHaveLength(1);
    const text = cast!.events.map((e) => e.data).join("");
    expect(text).toContain("key=*** ok");
    expect(text).not.toContain("abcdef123456");
  });

  it("skips a failing command instead of aborting, and returns null when nothing ran", () => {
    const result = buildGuardedCast([node("process.exit(3)")], { width: 100, height: 30 }, []);
    expect(result).toEqual({ cast: null, ran: [], skipped: [{ display: "node -e process.exit(3)", reason: "exited 3" }] });
  });
});
