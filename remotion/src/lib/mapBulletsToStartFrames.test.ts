import { describe, expect, it } from "vitest";
import { mapBulletsToStartFrames } from "./mapBulletsToStartFrames";
import type { SubtitleLine } from "./splitSubtitleLines";

const line = (startFrame: number, endFrame: number): SubtitleLine => ({ text: "x", startFrame, endFrame });

describe("mapBulletsToStartFrames", () => {
  it("maps each bullet to its matching sentence's start frame when counts are equal", () => {
    const lines = [line(0, 90), line(90, 180), line(180, 270)];
    // First sentence starts at frame 0, but the minimum-delay floor (see below) lifts it to 12.
    expect(mapBulletsToStartFrames(["a", "b", "c"], lines, 12)).toEqual([12, 90, 180]);
  });

  it("maps fewer bullets than sentences to the first N sentence start frames", () => {
    const lines = [line(0, 90), line(90, 180), line(180, 270)];
    expect(mapBulletsToStartFrames(["a", "b"], lines, 12)).toEqual([12, 90]);
  });

  it("clamps extra bullets beyond the sentence count to the last sentence's start frame", () => {
    const lines = [line(0, 90), line(90, 180)];
    expect(mapBulletsToStartFrames(["a", "b", "c", "d"], lines, 12)).toEqual([12, 90, 90, 90]);
  });

  it("falls back to a fixed step cadence when there are no sentence lines", () => {
    expect(mapBulletsToStartFrames(["a", "b", "c"], [], 12)).toEqual([12, 24, 36]);
  });

  it("never returns a frame below the minimum delay (keeps heading animation clear)", () => {
    // A sentence line that starts at frame 0 would otherwise collide with the heading's own entrance.
    const lines = [line(0, 90)];
    expect(mapBulletsToStartFrames(["a"], lines, 12)).toEqual([12]);
  });
});
