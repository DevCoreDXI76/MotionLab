import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aiImageSubjects,
  availableClipIds,
  collectEpisodeAssets,
  findAiImageReuse,
  LEDGER_PATH,
  ledgerPexelsIds,
  loadLedger,
  recordEpisode,
  usedDiagramKinds,
  validateAssetReuse,
} from "./assetLedger";
import type { AssetLedger } from "./assetLedger";
import { PROJECTS_DIR } from "./paths";

const script = (id: string) => JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, id, "script.json"), "utf-8"));
const ledgerWith008 = (): AssetLedger => ({ episodes: { "008_ai_visual": collectEpisodeAssets(script("008_ai_visual"), [39425776]) } });

describe("collectEpisodeAssets", () => {
  it("records aiImage prompts, clip ids, pexels ids and 3D scene kinds from a script", () => {
    const assets = collectEpisodeAssets(script("008_ai_visual"), [39425776]);
    expect(assets.aiImagePrompts).toHaveLength(2);
    expect(assets.existingClips).toEqual(["flow_01"]);
    expect(assets.pexelsIds).toEqual([39425776]);
    expect(assets.diagramKinds).toEqual(["stack"]);
  });
});

describe("aiImageSubjects", () => {
  it("keeps subject nouns and drops background words (desk, wooden, light) and filler", () => {
    expect([...aiImageSubjects("A desk lamp casting warm light across a wooden desk beside the edge of a dark keyboard")].sort()).toEqual(["keyboard", "lamp"]);
  });
});

describe("findAiImageReuse", () => {
  it("fails the 009 prompts against 008 (2+ shared subject nouns), naming the shared words", () => {
    const errors = findAiImageReuse(script("009_two_touches"), ledgerWith008(), "009_two_touches");
    expect(errors).toHaveLength(2);
    expect(errors.join(" ")).toContain("keyboard");
    expect(errors.join(" ")).toContain("lamp");
  });

  it("passes a prompt with a different subject", () => {
    const fresh = { scenes: [{ id: "s1", type: "title", visual: { kind: "aiImage", prompt: "A potted cactus beside a ceramic teapot on a windowsill at dawn" } }] };
    expect(findAiImageReuse(fresh, ledgerWith008(), "010_new")).toEqual([]);
  });

  it("ignores the episode's own earlier record (re-render / re-run)", () => {
    expect(findAiImageReuse(script("008_ai_visual"), ledgerWith008(), "008_ai_visual")).toEqual([]);
  });
});

describe("ledger lookups", () => {
  it("offers only clips no other episode used", () => {
    expect(availableClipIds(ledgerWith008(), ["flow_01", "flow_02"], "010_new")).toEqual(["flow_02"]);
    expect(availableClipIds(ledgerWith008(), ["flow_01"], "008_ai_visual")).toEqual(["flow_01"]);
  });

  it("collects pexels ids and 3D kinds from other episodes", () => {
    expect([...ledgerPexelsIds(ledgerWith008(), "010_new")]).toEqual([39425776]);
    expect([...ledgerPexelsIds(ledgerWith008(), "008_ai_visual")]).toEqual([]);
    expect([...usedDiagramKinds(ledgerWith008(), "010_new")]).toEqual(["stack"]);
  });

  it("rejects a 3D scene kind an earlier episode already used (device ③)", () => {
    const s = { scenes: [{ id: "d1", type: "diagram", props: { preset: "stack" } }] };
    expect(validateAssetReuse(s, ledgerWith008(), "010_new").join(" ")).toContain("stack");
    expect(validateAssetReuse(s, { episodes: {} }, "010_new")).toEqual([]);
  });

  it("rejects an already-used existingClip in a new script", () => {
    const s = { scenes: [{ id: "s2", type: "talkingPoint", visual: { kind: "existingClip", clipId: "flow_01" } }] };
    expect(validateAssetReuse(s, ledgerWith008(), "010_new").join(" ")).toContain("flow_01");
  });
});

describe("recordEpisode", () => {
  it("writes (or replaces) an episode entry in the ledger file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-"));
    const file = path.join(dir, "used_assets.json");
    try {
      recordEpisode("010_new", { aiImagePrompts: ["a"], existingClips: [], pexelsIds: [1], diagramKinds: [] }, file);
      recordEpisode("010_new", { aiImagePrompts: ["b"], existingClips: [], pexelsIds: [2], diagramKinds: [] }, file);
      expect(loadLedger(file).episodes["010_new"].pexelsIds).toEqual([2]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the committed ledger is backfilled for 003~009", () => {
    const ledger = loadLedger(LEDGER_PATH);
    expect(Object.keys(ledger.episodes).sort()).toEqual(["003_pipeline", "004_failures", "005_casting", "006_recap", "007_resolution", "008_ai_visual", "009_two_touches"]);
    expect(ledger.episodes["009_two_touches"].existingClips).toEqual(["flow_01"]);
  });
});
