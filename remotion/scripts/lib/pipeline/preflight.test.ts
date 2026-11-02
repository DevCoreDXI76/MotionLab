import path from "node:path";
import { describe, expect, it } from "vitest";
import { conceptOverlapCheck, WORST_CASE_NEURONS } from "./preflight";
import { PROJECTS_DIR } from "../paths";
import { CANDIDATES_PER_ROUND, GEN_HEIGHT, GEN_WIDTH, MAX_ROUNDS } from "../visualProviders/aiImage";
import { DAILY_FREE_NEURONS, estimateKleinNeurons, STOP_RATIO } from "../visualProviders/neuronLedger";

describe("preflight neuron budget", () => {
  it("reserves every klein call a real run can make: 2 aiImage scenes × all rounds × candidates", () => {
    expect(MAX_ROUNDS * CANDIDATES_PER_ROUND).toBe(4);
    expect(WORST_CASE_NEURONS).toBeCloseTo(2 * 4 * estimateKleinNeurons(GEN_WIDTH, GEN_HEIGHT), 5);
    expect(WORST_CASE_NEURONS).toBeLessThan(DAILY_FREE_NEURONS * STOP_RATIO);
  });
});

describe("conceptOverlapCheck (device ①)", () => {
  it("fails preflight with the ① re-selection message when the concept repeats an earlier episode", () => {
    const check = conceptOverlapCheck(path.join(PROJECTS_DIR, "009_two_touches", "concept.md"));
    expect(check.ok).toBe(false);
    expect(check.warnOnly).toBeFalsy();
    expect(check.detail).toContain("소재 중복 — ① 재선정 필요(유사 편: 008, 겹친 근거:");
  });

  it("passes for an episode with a fresh topic", () => {
    expect(conceptOverlapCheck(path.join(PROJECTS_DIR, "008_ai_visual", "concept.md")).ok).toBe(true);
  });
});
