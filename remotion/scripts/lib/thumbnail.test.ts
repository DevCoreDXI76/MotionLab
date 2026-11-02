import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computeThumbnailSeekMs } from "./thumbnail";
import { PROJECTS_DIR } from "./paths";

describe("computeThumbnailSeekMs", () => {
  it("uses 85% into the title scene (after its entrance animation) when there is one", () => {
    const seekMs = computeThumbnailSeekMs({
      scenes: [
        { type: "talkingPoint", durationMs: 4000, props: { bullets: ["a", "b"] } },
        { type: "title", durationMs: 10000 },
        { type: "outro", durationMs: 6000 },
      ],
    });
    expect(seekMs).toBe(4000 + 8500);
  });

  it("without a title, uses 90% into the first scene with bullets (all bullets shown)", () => {
    const seekMs = computeThumbnailSeekMs({
      scenes: [
        { type: "code", durationMs: 4000 },
        { type: "talkingPoint", durationMs: 10000, props: { bullets: [] } },
        { type: "talkingPoint", durationMs: 12000, props: { bullets: ["a", "b", "c"] } },
        { type: "outro", durationMs: 6000 },
      ],
    });
    expect(seekMs).toBe(4000 + 10000 + 10800);
  });

  it("falls back to 40% of total duration when there is neither a title nor bullets", () => {
    const seekMs = computeThumbnailSeekMs({
      scenes: [
        { type: "code", durationMs: 4000 },
        { type: "outro", durationMs: 6000 },
      ],
    });
    expect(seekMs).toBe(4000);
  });

  it("picks the title scene for the 008 script structure (not the one-bullet frame)", () => {
    const script = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, "008_ai_visual", "script.json"), "utf-8"));
    expect(computeThumbnailSeekMs(script)).toBe(Math.round(script.scenes[0].durationMs * 0.85));
  });
});
