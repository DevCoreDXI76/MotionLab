import { afterEach, describe, expect, it, vi } from "vitest";
import { pickBestFile, searchPortraitVideo } from "./pexels";
import type { PexelsVideoFile, PexelsVideoResult } from "./pexels";

function file(overrides: Partial<PexelsVideoFile>): PexelsVideoFile {
  return { quality: "hd", file_type: "video/mp4", width: 720, height: 1280, link: "https://example.com/a.mp4", ...overrides };
}

function video(overrides: Partial<PexelsVideoResult>): PexelsVideoResult {
  return {
    id: 1,
    width: 720,
    height: 1280,
    url: "https://pexels.com/video/1",
    user: { name: "photog", url: "https://pexels.com/@photog" },
    video_files: [],
    ...overrides,
  };
}

describe("pickBestFile", () => {
  it("rejects a below-threshold hd file (004/005/006's recurring 360x640 case)", () => {
    const files = [file({ quality: "hd", width: 360, height: 640 })];
    expect(pickBestFile(files)).toBeUndefined();
  });

  it("accepts a file at the 720x1280 floor confirmed sufficient in 006's log", () => {
    const files = [file({ quality: "hd", width: 720, height: 1280 })];
    expect(pickBestFile(files)?.height).toBe(1280);
  });

  it("still prefers hd over sd among files that clear the resolution floor", () => {
    const files = [file({ quality: "sd", width: 720, height: 1280 }), file({ quality: "hd", width: 1080, height: 1920 })];
    expect(pickBestFile(files)?.quality).toBe("hd");
  });

  it("ignores landscape files even if they clear the resolution floor", () => {
    const files = [file({ quality: "hd", width: 1920, height: 1080 })];
    expect(pickBestFile(files)).toBeUndefined();
  });

  it("falls back to sd when no hd file clears the floor but an sd file does", () => {
    const files = [file({ quality: "hd", width: 360, height: 640 }), file({ quality: "sd", width: 720, height: 1280 })];
    expect(pickBestFile(files)?.quality).toBe("sd");
  });
});

describe("searchPortraitVideo", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("skips a low-res candidate video and returns the next one that clears the floor", async () => {
    const videos = [
      video({ id: 1, video_files: [file({ quality: "hd", width: 360, height: 640 })] }),
      video({ id: 2, video_files: [file({ quality: "hd", width: 720, height: 1280, link: "https://example.com/good.mp4" })] }),
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ videos }) }) as unknown as typeof fetch;

    const result = await searchPortraitVideo("hands typing", "key");
    expect(result?.downloadUrl).toBe("https://example.com/good.mp4");
  });

  it("returns null when every candidate is below the resolution floor", async () => {
    const videos = [video({ id: 1, video_files: [file({ quality: "hd", width: 360, height: 640 })] })];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ videos }) }) as unknown as typeof fetch;

    const result = await searchPortraitVideo("hands typing", "key");
    expect(result).toBeNull();
  });
});
