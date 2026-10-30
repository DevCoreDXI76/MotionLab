import { describe, expect, it } from "vitest";
import { assessAiVisualFloor, validateVisualIntent } from "./visualIntent";

const ai = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "talkingPoint",
  visual: { kind: "aiImage" as const, prompt: "hands resting on a keyboard", ...extra },
});
const diagram = (id: string, labels: unknown = ["기획", "대본", "렌더"]) => ({
  id,
  type: "diagram",
  props: { heading: "구조", labels },
});

const valid = {
  scenes: [
    { id: "t", type: "title", visual: { kind: "pexels" as const, query: "hands typing close up" } },
    ai("a1"),
    diagram("d1"),
    ai("a2"),
    { id: "c", type: "code", props: {} },
    { id: "o", type: "outro", visual: { kind: "existingClip" as const, clipId: "flow_01" } },
  ],
};

describe("validateVisualIntent", () => {
  it("accepts a script meeting every floor and cap", () => {
    expect(validateVisualIntent(valid, ["flow_01"])).toEqual([]);
  });

  it("enforces the AI visual floor at script time", () => {
    const errors = validateVisualIntent({ scenes: [ai("a1"), { id: "t", type: "title", visual: { kind: "motion" as const } }] }, []);
    expect(errors).toContain("aiImage scenes: 1 (must be 2~4)");
    expect(errors).toContain("diagram scenes: 0 (must be 1~2)");
  });

  it("caps aiImage at 4 (Cloudflare quota)", () => {
    const scenes = [ai("a1"), ai("a2"), ai("a3"), ai("a4"), ai("a5"), diagram("d1")];
    expect(validateVisualIntent({ scenes }, [])).toEqual(["aiImage scenes: 5 (must be 2~4)"]);
  });

  it("requires kind-specific fields", () => {
    const scenes = [
      ai("a1", { prompt: " " }),
      ai("a2"),
      diagram("d1"),
      { id: "p", type: "talkingPoint", visual: { kind: "pexels" as const } },
      { id: "x", type: "outro", visual: { kind: "existingClip" as const, clipId: "veo_new" } },
      { id: "n", type: "title" },
    ];
    expect(validateVisualIntent({ scenes }, ["flow_01"])).toEqual([
      'scene "a1": aiImage needs visual.prompt',
      'scene "p": pexels needs visual.query',
      'scene "x": existingClip clipId must be one of flow_01',
      'scene "n": visual.kind is required',
    ]);
  });

  it("checks diagram labels (3~7 items, 8 chars max)", () => {
    const scenes = [ai("a1"), ai("a2"), diagram("d1", ["하나", "둘"]), diagram("d2", ["기획", "아주아주긴단계이름입니다", "렌더"])];
    expect(validateVisualIntent({ scenes }, [])).toEqual([
      'scene "d1": diagram props.labels must have 3~7 items',
      'scene "d2": diagram label "아주아주긴단계이름입니다" must be 1~8 characters',
    ]);
  });
});

describe("assessAiVisualFloor", () => {
  const rendered = (id: string, source: Record<string, unknown>) =>
    ai(id, { assetPath: `projects/x/images/${id}.jpg`, source });

  it("counts only aiImage scenes that rendered from Cloudflare without fallback", () => {
    const result = assessAiVisualFloor({
      scenes: [
        rendered("a1", { provider: "cloudflare-workers-ai", fallbackFrom: null }),
        rendered("a2", { provider: "cloudflare-workers-ai" }),
        diagram("d1"),
      ],
    });
    expect(result).toEqual({ met: true, aiImage: 2, diagram: 1, lost: [] });
  });

  it("fails the floor when an AI image fell back to Pexels", () => {
    const result = assessAiVisualFloor({
      scenes: [
        rendered("a1", { provider: "cloudflare-workers-ai" }),
        rendered("a2", { provider: "pexels", fallbackFrom: "aiImage", fallbackReason: "QuotaGuardError: over budget" }),
        diagram("d1"),
      ],
    });
    expect(result.met).toBe(false);
    expect(result.aiImage).toBe(1);
    expect(result.lost).toEqual(["a2 (QuotaGuardError: over budget)"]);
  });

  it("fails the floor without a diagram scene", () => {
    const result = assessAiVisualFloor({
      scenes: [rendered("a1", { provider: "cloudflare-workers-ai" }), rendered("a2", { provider: "cloudflare-workers-ai" })],
    });
    expect(result).toMatchObject({ met: false, aiImage: 2, diagram: 0 });
  });
});
