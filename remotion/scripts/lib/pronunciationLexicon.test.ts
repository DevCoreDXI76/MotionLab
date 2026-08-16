import { describe, expect, it } from "vitest";
import { applyLexicon, loadLexicon } from "./pronunciationLexicon";

describe("applyLexicon", () => {
  it("replaces a whole-word match with its lexicon pronunciation", () => {
    expect(applyLexicon("이건 JSON 파일입니다.", { JSON: "제이슨" })).toBe("이건 제이슨 파일입니다.");
  });

  it("replaces a match immediately followed by a Korean particle (no ASCII word boundary)", () => {
    expect(applyLexicon("JSON을 파싱합니다.", { JSON: "제이슨" })).toBe("제이슨을 파싱합니다.");
  });

  it("does not touch a substring match inside a larger token", () => {
    expect(applyLexicon("JSONPlaceholder를 씁니다.", { JSON: "제이슨" })).toBe("JSONPlaceholder를 씁니다.");
  });

  it("leaves text unchanged when the lexicon is empty", () => {
    expect(applyLexicon("이건 JSON 파일입니다.", {})).toBe("이건 JSON 파일입니다.");
  });

  it("applies multiple lexicon entries, longest key first, without cross-clobbering", () => {
    const result = applyLexicon("API와 JSON을 같이 씁니다.", { JSON: "제이슨", API: "에이피아이" });
    expect(result).toBe("에이피아이와 제이슨을 같이 씁니다.");
  });

  it("escapes regex-special characters in lexicon keys", () => {
    expect(applyLexicon("Node.js로 만들었습니다.", { "Node.js": "노드제이에스" })).toBe(
      "노드제이에스로 만들었습니다.",
    );
  });

  it("does not mutate the input string's other content", () => {
    const input = "이 문장에는 JSON이 없습니다";
    expect(applyLexicon(input, { XML: "엑스엠엘" })).toBe(input);
  });
});

describe("loadLexicon", () => {
  it("loads templates/tts_lexicon.json and includes the confirmed JSON entry", () => {
    const lexicon = loadLexicon();
    expect(lexicon.JSON).toBe("제이슨");
  });
});
