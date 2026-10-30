import { describe, expect, it } from "vitest";
import { buildClipFfmpegArgs, loadExistingClips, prepareExistingClip } from "./existingClip";

describe("existingClip", () => {
  it("registers flow_01 as a reused clip, not a new generation", () => {
    expect(loadExistingClips().flow_01).toMatchObject({
      source: "projects/008_spike/spike/B_video/flow_01.mp4",
      cropBottomRatio: 0.05,
    });
  });

  it("mutes, trims and crops the watermark strip off the bottom", () => {
    const args = buildClipFfmpegArgs(
      { source: "x", description: "", origin: "", startSec: 0.5, durationSec: 6, cropBottomRatio: 0.05 },
      "in.mp4",
      "out.mp4",
    );
    expect(args).toEqual([
      "-v", "error", "-y", "-ss", "0.5", "-t", "6", "-i", "in.mp4", "-an",
      "-vf", "crop=iw:trunc(ih*0.9500/2)*2:0:0", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "out.mp4",
    ]);
  });

  it("returns null for an unregistered clip id so the caller can fall back", () => {
    const logs: string[] = [];
    const ctx = { projectId: "p", sceneId: "s", sceneType: "outro", log: (m: string) => logs.push(m) };
    expect(prepareExistingClip(ctx, "veo_new")).toBeNull();
    expect(logs[0]).toContain("not in templates/existing_clips.json");
  });
});
