import { describe, expect, it } from "vitest";
import { WORST_CASE_NEURONS } from "./preflight";
import { CANDIDATES_PER_ROUND, GEN_HEIGHT, GEN_WIDTH, MAX_ROUNDS } from "../visualProviders/aiImage";
import { DAILY_FREE_NEURONS, estimateKleinNeurons, STOP_RATIO } from "../visualProviders/neuronLedger";

describe("preflight neuron budget", () => {
  it("reserves every klein call a real run can make: 2 aiImage scenes × all rounds × candidates", () => {
    expect(MAX_ROUNDS * CANDIDATES_PER_ROUND).toBe(4);
    expect(WORST_CASE_NEURONS).toBeCloseTo(2 * 4 * estimateKleinNeurons(GEN_WIDTH, GEN_HEIGHT), 5);
    expect(WORST_CASE_NEURONS).toBeLessThan(DAILY_FREE_NEURONS * STOP_RATIO);
  });
});
