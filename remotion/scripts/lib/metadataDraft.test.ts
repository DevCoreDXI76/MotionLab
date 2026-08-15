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
