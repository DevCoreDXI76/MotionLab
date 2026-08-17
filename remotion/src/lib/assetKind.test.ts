import { describe, expect, it } from "vitest";
import { isVideoAsset } from "./assetKind";

describe("isVideoAsset", () => {
  it("recognizes common video extensions", () => {
    expect(isVideoAsset("projects/002_test/videos/studio-demo.mp4")).toBe(true);
    expect(isVideoAsset("clip.webm")).toBe(true);
    expect(isVideoAsset("clip.MOV")).toBe(true);
  });

  it("treats image extensions as not-video", () => {
    expect(isVideoAsset("projects/002_test/images/scene-1-title.png")).toBe(false);
    expect(isVideoAsset("photo.JPG")).toBe(false);
  });
});
