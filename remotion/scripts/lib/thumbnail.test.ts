import { describe, expect, it } from "vitest";
import { computeThumbnailSeekMs } from "./thumbnail";

describe("computeThumbnailSeekMs", () => {
  it("returns the midpoint of the first code scene", () => {
    const seekMs = computeThumbnailSeekMs({
      scenes: [
        { type: "title", durationMs: 4000 },
        { type: "talkingPoint", durationMs: 12000 },
        { type: "code", durationMs: 8000 },
        { type: "outro", durationMs: 6000 },
      ],
    });
    // elapsed before code scene: 4000 + 12000 = 16000; midpoint of the 8000ms code scene: +4000
    expect(seekMs).toBe(20000);
  });

  it("falls back to 40% of total duration when there is no code scene", () => {
    const seekMs = computeThumbnailSeekMs({
      scenes: [
        { type: "title", durationMs: 4000 },
        { type: "talkingPoint", durationMs: 6000 },
      ],
    });
    expect(seekMs).toBe(4000); // 40% of 10000
  });

  it("uses the first code scene when there are multiple", () => {
    const seekMs = computeThumbnailSeekMs({
      scenes: [
        { type: "code", durationMs: 4000 },
        { type: "code", durationMs: 4000 },
      ],
    });
    expect(seekMs).toBe(2000);
  });
});
