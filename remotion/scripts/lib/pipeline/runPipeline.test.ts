import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptValidationError } from "../claudeScriptGenerator";
import { buildUploadArgs, LENGTH_GATE_MAX_MS, LENGTH_GATE_RETRIES, lengthGateFeedback, runPipeline } from "./runPipeline";
import { NARRATION_MAX_CHARS } from "../scriptSchema";
import type { PipelineDeps } from "./runPipeline";
import { decideVerdict, VERDICTS } from "./report";
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
    ledger: vi.fn(() => ({ episodes: {} })),
    recordAssets: vi.fn(),
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

describe("asset ledger (device ②)", () => {
  const LEDGER_008 = { episodes: { "008_ai_visual": { aiImagePrompts: ["A ceramic mug steaming beside a backlit mechanical keyboard"], existingClips: ["flow_01"], pexelsIds: [1], diagramKinds: [] } } };

  it("feeds a repeated aiImage subject back into the script retry loop", async () => {
    const fresh = structuredClone(GOOD_SCRIPT);
    fresh.scenes[0].visual = { kind: "aiImage", prompt: "a potted cactus on a windowsill", query: "cactus close up" };
    const writeScript = vi.fn<PipelineDeps["writeScript"]>().mockImplementationOnce(() => structuredClone(GOOD_SCRIPT)).mockImplementation(() => fresh);
    const report = await run(deps({ writeScript, ledger: vi.fn(() => LEDGER_008) }));
    expect(writeScript).toHaveBeenCalledTimes(2);
    expect(writeScript.mock.calls[1][2].join(" ")).toContain("repeats an earlier episode's image (008: mug, keyboard)");
    expect(report.steps[1].status).toBe("ok");
  });

  it("records the episode's assets after a successful upload, never in dry-run", async () => {
    const upload = vi.fn(() => {
      fs.mkdirSync(path.join(projectsDir, ID, "output"), { recursive: true });
      fs.writeFileSync(path.join(projectsDir, ID, "output", `${ID}.upload_result.json`), JSON.stringify({ youtube_url: "https://youtu.be/x", uploaded_privacy: "private" }));
      return 0;
    });
    const full = deps({ upload });
    await run(full, false);
    expect(full.recordAssets).toHaveBeenCalledWith(ID, expect.objectContaining({ scenes: expect.any(Array) }));

    const dry = deps();
    await run(dry, true);
    expect(dry.recordAssets).not.toHaveBeenCalled();
  });
});

describe("verdict wording (device ③)", () => {
  const floor = (met: boolean, required: { aiImage: number; diagram: number }) => ({ met, aiImage: 0, diagram: 0, lost: [], required });
  const steps = [{ name: "render" as const, status: "ok" as const, attempts: 1, seconds: 1, notes: [] }];

  it("keeps the 2기 wording for 008 and uses the aiImage-min-1 wording for new episodes", () => {
    expect(decideVerdict({ projectId: "008_ai_visual", steps, mode: "full", uploadUrl: null, floor: floor(false, { aiImage: 2, diagram: 1 }) })).toBe(VERDICTS.floorMissed);
    expect(decideVerdict({ projectId: "010_next", steps, mode: "full", uploadUrl: null, floor: floor(false, { aiImage: 1, diagram: 0 }) })).toBe("완주했으나 AI 비주얼 하한 미달(aiImage 최소 1)");
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

describe("length gate (backlog 2)", () => {
  const narrateWith = (...sceneMs: number[]) =>
    vi.fn<PipelineDeps["narrate"]>(async (_id, script) => ({
      ...script,
      scenes: script.scenes.map((s, i) => ({ ...s, durationMs: sceneMs[i] ?? 1000, audioPath: `a/${s.id}.mp3` })),
    }));

  it("signals a regeneration only when the measured total exceeds 59,000ms", () => {
    const scenes = (total: number) => ({ scenes: [{ narration: "가".repeat(100), durationMs: total - 1000 }, { narration: "나", durationMs: 1000 }] });
    expect(lengthGateFeedback(scenes(LENGTH_GATE_MAX_MS))).toBeNull();
    const feedback = lengthGateFeedback(scenes(LENGTH_GATE_MAX_MS + 1));
    expect(feedback).not.toBeNull();
    expect(feedback).toContain("59.0초");
  });

  it("regenerates from the script step with the overrun in the feedback, without a human", async () => {
    const narrate = vi.fn<PipelineDeps["narrate"]>().mockImplementationOnce(narrateWith(15_000, 15_000, 15_000, 15_000, 15_000)).mockImplementation(deps().narrate);
    const d = deps({ narrate });
    const report = await run(d);
    expect(d.writeScript).toHaveBeenCalledTimes(2);
    expect((d.writeScript as ReturnType<typeof vi.fn>).mock.calls[1][2][0]).toContain("75.0초");
    expect(report.steps.find((s) => s.name === "narration")).toMatchObject({ status: "ok", attempts: 2 });
    expect(report.fallbacks.some((f) => f.step === "narration" && f.detail.includes("길이 게이트"))).toBe(true);
    expect(report.interventions).toEqual([]);
  });

  it(`stops after ${LENGTH_GATE_RETRIES} regenerations when the video is still too long`, async () => {
    const d = deps({ narrate: narrateWith(15_000, 15_000, 15_000, 15_000, 15_000) });
    const report = await run(d);
    expect(d.writeScript).toHaveBeenCalledTimes(LENGTH_GATE_RETRIES + 1);
    expect(report.steps.find((s) => s.name === "narration")?.status).toBe("failed");
    expect(d.render).not.toHaveBeenCalled();
    expect(report.verdict).toBe(VERDICTS.stopped);
  });

  it("feeds an over-long narration back into the script retry loop", async () => {
    const long = structuredClone(GOOD_SCRIPT);
    long.scenes[0].narration = "가".repeat(NARRATION_MAX_CHARS + 1);
    const writeScript = vi.fn<PipelineDeps["writeScript"]>().mockImplementationOnce(() => long).mockImplementation(() => structuredClone(GOOD_SCRIPT));
    const report = await run(deps({ writeScript }));
    expect(writeScript).toHaveBeenCalledTimes(2);
    expect(writeScript.mock.calls[1][2].join(" ")).toContain("자");
    expect(report.steps[1]).toMatchObject({ status: "ok", attempts: 2 });
  });
});
