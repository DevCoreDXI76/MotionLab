import { describe, expect, it } from "vitest";
import { splitSubtitleLines } from "./splitSubtitleLines";

describe("splitSubtitleLines", () => {
  it("returns an empty array for empty text", () => {
    expect(splitSubtitleLines("", 300)).toEqual([]);
  });

  it("returns a single line spanning the full duration when there is no sentence punctuation", () => {
    const lines = splitSubtitleLines("문장부호가 없는 나레이션", 300);
    expect(lines).toEqual([{ text: "문장부호가 없는 나레이션", startFrame: 0, endFrame: 300 }]);
  });

  it("splits multiple sentences and covers the full duration with no gaps or overlaps", () => {
    const lines = splitSubtitleLines("짧다. 이건 조금 더 긴 문장입니다.", 300);

    expect(lines).toHaveLength(2);
    expect(lines[0].startFrame).toBe(0);
    expect(lines[lines.length - 1].endFrame).toBe(300);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].startFrame).toBe(lines[i - 1].endFrame);
    }
  });

  it("allocates duration proportionally to sentence length (longer sentence gets more frames)", () => {
    const lines = splitSubtitleLines("짧다. 이건 훨씬 더 길게 쓴 두번째 문장입니다.", 300);

    const firstSpan = lines[0].endFrame - lines[0].startFrame;
    const secondSpan = lines[1].endFrame - lines[1].startFrame;
    expect(secondSpan).toBeGreaterThan(firstSpan);
  });

  it("splits on !, ?, and newlines in addition to periods", () => {
    const lines = splitSubtitleLines("정말요?\n네 진짜예요!", 300);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("정말요?");
    expect(lines[1].text).toBe("네 진짜예요!");
  });

  it("ignores empty/whitespace-only segments produced by splitting", () => {
    const lines = splitSubtitleLines("첫 문장.   둘째 문장.  ", 300);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.text.length > 0)).toBe(true);
  });
  it("does not split on a decimal point between digits", () => {
    const lines = splitSubtitleLines("속도가 1.7배 느려졌어요. 끝.", 300);
    expect(lines.map((l) => l.text)).toEqual(["속도가 1.7배 느려졌어요.", "끝."]);
  });

  it("keeps a version number like 2.0 inside one sentence", () => {
    const lines = splitSubtitleLines("버전 2.0을 썼다.", 300);
    expect(lines.map((l) => l.text)).toEqual(["버전 2.0을 썼다."]);
  });

  it("keeps multiple decimals intact while still splitting at sentence ends", () => {
    const lines = splitSubtitleLines("3.14와 2.5를 비교. 다음.", 300);
    expect(lines.map((l) => l.text)).toEqual(["3.14와 2.5를 비교.", "다음."]);
  });

  it("does not split v2.0-style versions", () => {
    const lines = splitSubtitleLines("v2.0 출시. 끝.", 300);
    expect(lines.map((l) => l.text)).toEqual(["v2.0 출시.", "끝."]);
  });
});
