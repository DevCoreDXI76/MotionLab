import { describe, expect, it, vi } from "vitest";
import { pexelsQueryVariants, resolveSceneVisual } from "./resolveVisual";
import type { ResolveDeps } from "./resolveVisual";
import type { ProviderResult } from "./types";

const ctx = { projectId: "p", sceneId: "s1", sceneType: "talkingPoint", log: () => {} };
const result = (provider: ProviderResult["source"]["provider"], assetPath: string | null): ProviderResult => ({
  assetPath,
  source: { provider, generatedAt: "2026-11-01T00:00:00Z" },
});

function deps(overrides: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    aiImage: vi.fn(async () => result("cloudflare-workers-ai", "projects/p/images/s1.jpg")),
    pexels: vi.fn(async () => result("pexels", "projects/p/videos/s1-broll.mp4")),
    existingClip: vi.fn(() => result("existing-clip", "projects/p/videos/s1-clip.mp4")),
    ...overrides,
  };
}

describe("pexelsQueryVariants", () => {
  it("tries the query, then without its last word, then the scene-type default", () => {
    expect(pexelsQueryVariants("hands typing code close up", "talkingPoint")).toEqual([
      "hands typing code close up",
      "hands typing code close",
      "hands typing code on laptop close up",
    ]);
    expect(pexelsQueryVariants(null, "outro")).toEqual(["laptop screen glowing in dark room close up"]);
  });
});

describe("resolveSceneVisual", () => {
  it("leaves legacy scenes without visual.kind untouched (001~007)", async () => {
    const d = deps();
    const visual = { assetPath: "projects/007/videos/a.mp4" };
    expect(await resolveSceneVisual({ id: "s1", type: "title", visual }, ctx, d)).toEqual({ visual, events: [] });
    expect(d.pexels).not.toHaveBeenCalled();
  });

  it("uses the AI image when generation succeeds", async () => {
    const { visual, events } = await resolveSceneVisual(
      { id: "s1", type: "talkingPoint", visual: { kind: "aiImage", prompt: "hands", query: "hands typing" } },
      ctx,
      deps(),
    );
    expect(events).toEqual([]);
    expect(visual).toMatchObject({ kind: "aiImage", assetPath: "projects/p/images/s1.jpg", source: { provider: "cloudflare-workers-ai", fallbackFrom: null } });
  });

  it("falls back from aiImage to Pexels using the scene's own query, without waiting", async () => {
    const d = deps({ aiImage: vi.fn(async () => Promise.reject(new Error("over budget"))) });
    const { visual, events } = await resolveSceneVisual(
      { id: "s1", type: "talkingPoint", visual: { kind: "aiImage", prompt: "hands", query: "hands typing" } },
      ctx,
      d,
    );
    expect(d.pexels).toHaveBeenCalledWith(ctx, "hands typing");
    expect(events).toEqual([{ sceneId: "s1", from: "aiImage", to: "pexels", reason: "Error: over budget" }]);
    expect(visual?.source).toMatchObject({ provider: "pexels", fallbackFrom: "aiImage", fallbackReason: "Error: over budget" });
  });

  it("walks Pexels query variants, surviving API errors, before giving up to motion", async () => {
    const pexels = vi
      .fn<ResolveDeps["pexels"]>()
      .mockRejectedValueOnce(new Error("Pexels API error 500"))
      .mockResolvedValue(null);
    const { visual, events } = await resolveSceneVisual(
      { id: "s1", type: "talkingPoint", visual: { kind: "pexels", query: "hands typing code", cue: "checklist" } },
      ctx,
      deps({ pexels }),
    );
    expect(pexels).toHaveBeenCalledTimes(3);
    expect(events).toEqual([{ sceneId: "s1", from: "pexels", to: "motion", reason: "no result for any query variant" }]);
    expect(visual).toMatchObject({ assetPath: null, cue: "checklist", source: { provider: "motion", fallbackFrom: "pexels" } });
  });

  it("falls back from a missing existing clip to Pexels", async () => {
    const { visual, events } = await resolveSceneVisual(
      { id: "s1", type: "outro", visual: { kind: "existingClip", clipId: "flow_01" } },
      { ...ctx, sceneType: "outro" },
      deps({ existingClip: vi.fn(() => null) }),
    );
    expect(events[0]).toMatchObject({ from: "existingClip", to: "pexels" });
    expect(visual?.source).toMatchObject({ provider: "pexels", fallbackFrom: "existingClip" });
  });

  it("masks secret values in fallback reasons", async () => {
    vi.resetModules();
    vi.doMock("../secrets", async (orig) => ({
      ...(await orig<typeof import("../secrets")>()),
      maskSecrets: (t: string) => t.replace("tok_123456789", "***"),
    }));
    const { resolveSceneVisual: resolve } = await import("./resolveVisual");
    const { events } = await resolve(
      { id: "s1", type: "talkingPoint", visual: { kind: "aiImage", prompt: "hands" } },
      ctx,
      deps({ aiImage: vi.fn(async () => Promise.reject(new Error("401 for tok_123456789"))) }),
    );
    expect(events[0].reason).toBe("Error: 401 for ***");
    vi.doUnmock("../secrets");
  });
});
