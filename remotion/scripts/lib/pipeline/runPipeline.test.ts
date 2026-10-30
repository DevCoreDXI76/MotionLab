import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptValidationError } from "../claudeScriptGenerator";
import { buildUploadArgs, runPipeline } from "./runPipeline";
import type { PipelineDeps } from "./runPipeline";
import { VERDICTS } from "./report";
import { demoteOverCapVisuals } from "./normalize";

const ID = "008_test";
let projectsDir: string;
const scriptPath = () => path.join(projectsDir, ID, "script.json");
const readScript = () => JSON.parse(fs.readFileSync(scriptPath(), "utf-8"));

const GOOD_SCRIPT = {
  id: "whatever",
  title: "테스트 편",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "훅입니다.", props: { title: "훅" }, visual: { kind: "aiImage", prompt: "a mug beside a keyboard", query: "mug keyboard close up" } },
    { id: "s2", type: "talkingPoint", narration: "설명입니다.", props: { heading: "h", bullets: ["a"] }, visual: { kind: "aiImage", prompt: "keyboard corner", query: "keyboard close up" } },
    { id: "s3", type: "diagram", narration: "구조입니다.", props: { heading: "구조", preset: "stack", labels: ["대본", "TTS", "렌더"] } },
    { id: "s4", type: "code", narration: "명령입니다.", props: { language: "bash", code: "git log --oneline -3", commands: [{ display: "git log --oneline -3", argv: ["git", "log", "--oneline", "-3"], cwd: "root" }] } },
    { id: "s5", type: "outro", narration: "끝입니다.", props: { message: "끝" }, visual: { kind: "pexels", query: "hands typing close up" } },
  ],
};

/** Simulates the visual providers: AI scenes get a Cloudflare source unless listed in `fellBack`. */
const fakeVisuals = (fellBack: string[] = []) =>
  vi.fn(async () => {
    const script = readScript();
    for (const scene of script.scenes) {
      if (!scene.visual?.kind) continue;
      const lost = fellBack.includes(scene.id);
      const provider = scene.visual.kind === "aiImage" && !lost ? "cloudflare-workers-ai" : "pexels";
      scene.visual = { ...scene.visual, assetPath: `projects/${ID}/x/${scene.id}`, source: { provider, fallbackFrom: lost ? "aiImage" : null, fallbackReason: lost ? "quota" : null } };
    }
    fs.writeFileSync(scriptPath(), JSON.stringify(script));
    return fellBack.map((sceneId) => ({ sceneId, from: "aiImage" as const, to: "pexels" as const, reason: "quota" }));
  });

function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    preflight: vi.fn(async () => [{ name: "all", ok: true, detail: "" }]),
    writeScript: vi.fn(() => structuredClone(GOOD_SCRIPT)),
    narrate: vi.fn(async (_id, script) => ({ ...script, scenes: script.scenes.map((s: { id: string }) => ({ ...s, durationMs: 1000, audioPath: `a/${s.id}.mp3` })) })),
    visuals: fakeVisuals(),
    render: vi.fn(() => 0),
    upload: vi.fn(() => 0),
    castCommands: vi.fn((_id, scene) => (scene.props?.commands ? { source: "script" as const, commands: [{ display: "git log --oneline -3", command: "git", args: [], cwd: "." }], rejected: [] } : null)),
    runCast: vi.fn(() => ({ cast: { header: { version: 2 as const, width: 100, height: 30, timestamp: 0 }, events: [] }, ran: ["git log --oneline -3"], skipped: [] })),
    neuronsToday: vi.fn(() => 0),
    sleep: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
  fs.mkdirSync(path.join(projectsDir, ID));
  fs.writeFileSync(path.join(projectsDir, ID, "concept.md"), "# 테스트 concept\n".repeat(10));
});
afterEach(() => fs.rmSync(projectsDir, { recursive: true, force: true }));

const run = (d: PipelineDeps, dryRun = true) => runPipeline(ID, { dryRun, projectsDir, log: () => {} }, d);

describe("runPipeline", () => {
  it("runs every step without a human and meets the AI-visual floor (dry-run)", async () => {
    const d = deps();
    const report = await run(d);
    expect(report.steps.map((s) => [s.name, s.status])).toEqual([
      ["preflight", "ok"], ["script", "ok"], ["cast", "ok"], ["narration", "ok"], ["visuals", "ok"], ["render", "ok"], ["upload", "ok"],
    ]);
    expect(report.interventions).toEqual([]);
    expect(report.verdict).toBe(VERDICTS.dryRunDone);
    expect(d.upload).not.toHaveBeenCalled();
    const script = readScript();
    expect(script).toMatchObject({ id: ID, format: "shorts", fps: 30, width: 1080, height: 1920 });
    expect(script.scenes[3].props.cast).toBeDefined();
    const log = fs.readFileSync(path.join(projectsDir, ID, "log.md"), "utf-8");
    expect(log).toContain("## 자동 실행 기록 (produce.ts)");
    expect(log).toContain(VERDICTS.dryRunDone);
    expect(log).toContain("사람 개입(이 실행 중)**: 0건");
  });

  it("stops before any expensive step when preflight fails, and records one intervention", async () => {
    const d = deps({ preflight: vi.fn(async () => [{ name: "Edge TTS 1문장", ok: false, detail: "HTTP 403" }, { name: "clip", ok: false, detail: "없음", warnOnly: true }]) });
    const report = await run(d);
    expect(report.steps[0]).toMatchObject({ name: "preflight", status: "failed" });
    expect(report.steps.slice(1).every((s) => s.status === "skipped")).toBe(true);
    expect(d.writeScript).not.toHaveBeenCalled();
    expect(report.interventions).toHaveLength(1);
    expect(report.interventions[0].reason).toContain("Edge TTS 1문장: HTTP 403");
    expect(report.verdict).toBe(VERDICTS.stopped);
    expect(fs.readFileSync(path.join(projectsDir, ID, "log.md"), "utf-8")).toContain("⚠ preflight");
  });

  it("feeds schema and intent errors back into the next script attempt", async () => {
    const underFloor = structuredClone(GOOD_SCRIPT);
    underFloor.scenes[1].visual = { kind: "pexels", prompt: "", query: "q" };
    const writeScript = vi
      .fn<PipelineDeps["writeScript"]>()
      .mockImplementationOnce(() => {
        throw new ScriptValidationError(["/scenes/0 must have required property 'narration'"]);
      })
      .mockImplementationOnce(() => underFloor)
      .mockImplementation(() => structuredClone(GOOD_SCRIPT));
    const report = await run(deps({ writeScript }));
    expect(writeScript).toHaveBeenCalledTimes(3);
    expect(writeScript.mock.calls[1][2]).toEqual(["/scenes/0 must have required property 'narration'"]);
    expect(writeScript.mock.calls[2][2]).toEqual(["aiImage scenes: 1 (must be 2~2)"]);
    expect(report.steps[1]).toMatchObject({ status: "ok", attempts: 3 });
    expect(report.fallbacks.filter((f) => f.step === "script")).toHaveLength(2);
    expect(report.interventions).toEqual([]);
  });

  it("gives up on the script after 3 CLI failures, waiting 30s between tries", async () => {
    const d = deps({ writeScript: vi.fn(() => { throw new Error("claude -p exited with status 1"); }) });
    const report = await run(d);
    expect(d.writeScript).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenCalledWith(30_000);
    expect(report.steps[1].status).toBe("failed");
    expect(report.verdict).toBe(VERDICTS.stopped);
  });

  it("retries TTS with backoff before giving up", async () => {
    const narrate = vi.fn<PipelineDeps["narrate"]>().mockRejectedValueOnce(new Error("403")).mockImplementation(deps().narrate);
    const report = await run(deps({ narrate }));
    expect(narrate).toHaveBeenCalledTimes(2);
    expect(report.steps[3]).toMatchObject({ status: "ok", attempts: 2 });
  });

  it("finishes but reports the 2기 goal as missed when an AI image fell back", async () => {
    const report = await run(deps({ visuals: fakeVisuals(["s2"]) }));
    expect(report.floor).toMatchObject({ met: false, aiImage: 1, lost: ["s2 (quota)"] });
    expect(report.verdict).toBe(VERDICTS.floorMissed);
    expect(report.interventions).toEqual([]);
  });

  it("demotes the 3D scene after two failed renders, and the floor then fails", async () => {
    const render = vi.fn<PipelineDeps["render"]>().mockReturnValueOnce(1).mockReturnValueOnce(1).mockReturnValue(0);
    const report = await run(deps({ render }));
    expect(render).toHaveBeenCalledTimes(3);
    expect(readScript().scenes[2]).toMatchObject({ type: "talkingPoint", props: { heading: "구조", bullets: ["대본", "TTS", "렌더"] } });
    expect(report.floor).toMatchObject({ met: false, diagram: 0 });
    expect(report.verdict).toBe(VERDICTS.floorMissed);
  });

  it("counts running an episode again as a human intervention", async () => {
    await run(deps());
    const second = await run(deps());
    expect(second.interventions).toEqual([{ step: "run", reason: "이전 실행 기록이 있는 편을 다시 실행함(재실행 판단은 사람 개입)" }]);
    expect(fs.readFileSync(path.join(projectsDir, ID, "log.md"), "utf-8").match(/### /g)).toHaveLength(2);
  });

  it("uploads privately in full mode and flags a failed playlist add as an intervention", async () => {
    const upload = vi.fn(() => {
      fs.mkdirSync(path.join(projectsDir, ID, "output"), { recursive: true });
      fs.writeFileSync(
        path.join(projectsDir, ID, "output", `${ID}.upload_result.json`),
        JSON.stringify({ youtube_url: "https://youtu.be/x", uploaded_privacy: "private", playlist_result: { added: false } }),
      );
      return 0;
    });
    const report = await run(deps({ upload }), false);
    expect(report.uploadUrl).toBe("https://youtu.be/x");
    expect(report.verdict).toBe(VERDICTS.uploaded);
    expect(report.interventions).toEqual([{ step: "upload", reason: "재생목록 자동 추가 실패 — YouTube Studio에서 수동 추가 필요" }]);
  });
});

describe("pipeline helpers", () => {
  it("never passes --privacy or --force to the uploader (D5)", () => {
    const args = buildUploadArgs("008_x");
    expect(args.slice(1)).toEqual(["--project", "projects/008_x"]);
    expect(args.join(" ")).not.toMatch(/--privacy|--force/);
  });

  it("demotes over-cap AI images to Pexels (or motion without a query)", () => {
    const scenes = [1, 2, 3, 4].map((i) => ({ id: `s${i}`, type: "talkingPoint", visual: { kind: "aiImage" as const, query: i === 4 ? null : "q" } }));
    const { script, demoted } = demoteOverCapVisuals({ scenes });
    expect(script.scenes.map((s) => s.visual?.kind)).toEqual(["aiImage", "aiImage", "pexels", "motion"]);
    expect(demoted).toHaveLength(2);
  });
});
