import { describe, expect, it } from "vitest";
import { generateMetadataDraft } from "./metadataDraft";

describe("generateMetadataDraft", () => {
  it("includes title, a narration-based summary, and shorts hashtags", () => {
    const draft = generateMetadataDraft({
      title: "코드로 만드는 쇼츠",
      format: "shorts",
      scenes: [{ narration: "오늘은 Remotion으로 쇼츠를 자동 생성하는 법을 알아봅니다." }],
    });
    expect(draft).toContain("코드로 만드는 쇼츠");
    expect(draft).toContain("Remotion으로 쇼츠를 자동 생성");
    expect(draft).toContain("#shorts");
  });

  it("uses long-form hashtags for the long format", () => {
    const draft = generateMetadataDraft({ title: "T", format: "long", scenes: [{ narration: "N" }] });
    expect(draft).not.toContain("#shorts");
  });
});

describe("generateMetadataDraft — 2기 visual sources", () => {
  const scene = (narration: string, source?: Record<string, unknown>) => ({ narration, visual: source ? { source } : null });

  it("credits Pexels photographers and discloses AI visuals, flagging synthetic media", () => {
    const draft = generateMetadataDraft({
      title: "T",
      format: "shorts",
      scenes: [
        scene("하나.", { provider: "cloudflare-workers-ai" }),
        scene("둘.", { provider: "pexels", photographer: "ArtHouse Studio" }),
        scene("셋.", { provider: "pexels", photographer: "ArtHouse Studio" }),
        scene("넷.", { provider: "existing-clip", aiGenerator: "Google Veo 3.1 Lite" }),
      ],
    });
    expect(draft).toBe(
      [
        "합성 콘텐츠: 예",
        "",
        "제목: T",
        "",
        "설명: 하나. 둘. 셋. 넷.",
        "",
        "일부 배경 이미지는 AI(FLUX.2 klein)로 생성했습니다.",
        "일부 영상 클립은 AI(Google Veo 3.1 Lite)로 생성했습니다.",
        "B-roll 영상: Pexels — ArtHouse Studio",
        "",
        "해시태그: #shorts #모션랩 #자동화영상",
      ].join("\n"),
    );
  });

  it("does not flag synthetic media for Pexels-only episodes", () => {
    const draft = generateMetadataDraft({ title: "T", format: "shorts", scenes: [scene("하나.", { provider: "pexels", photographer: "P" })] });
    expect(draft.startsWith("제목: T")).toBe(true);
    expect(draft).toContain("B-roll 영상: Pexels — P");
  });

  it("keeps the description under the limit including the credit lines", () => {
    const draft = generateMetadataDraft({ title: "T", format: "shorts", scenes: [scene("가".repeat(6000), { provider: "cloudflare-workers-ai" })] });
    const description = draft.split("설명: ")[1].split("\n\n해시태그:")[0];
    expect(description.length).toBe(4900);
    expect(description.endsWith("생성했습니다.")).toBe(true);
  });
});
