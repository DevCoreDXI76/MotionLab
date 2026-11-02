import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareConcepts, findConceptOverlap, JACCARD_MAX, loadEpisode, numericFacts, SHARED_FACTS_MAX } from "./conceptOverlap";
import { PROJECTS_DIR } from "../paths";

const episode = (id: string) => loadEpisode(PROJECTS_DIR, id)!;

describe("numericFacts", () => {
  it("normalizes Korean number words and ignores the generic 'one'", () => {
    expect([...numericFacts("일곱 단계, 7단계, 0원, 5분 44초, 1.7배, 쇼츠 한 편, 메모 한 장")].sort()).toEqual(["0원", "1.7배", "44초", "5분", "7단계"]);
  });
});

describe("compareConcepts — thresholds fixed on real episodes", () => {
  it("flags 009 against 008 as a duplicate topic", () => {
    const r = compareConcepts(episode("009_two_touches").concept, episode("008_ai_visual"));
    expect(r.duplicate).toBe(true);
    expect(r.sharedFacts).toEqual(expect.arrayContaining(["7단계", "0원"]));
  });

  it("passes 008 against 007", () => {
    expect(compareConcepts(episode("008_ai_visual").concept, episode("007_resolution")).duplicate).toBe(false);
  });

  it("passes 007 against 006", () => {
    expect(compareConcepts(episode("007_resolution").concept, episode("006_recap")).duplicate).toBe(false);
  });

  it(`treats ${SHARED_FACTS_MAX}+ shared facts or Jaccard > ${JACCARD_MAX} as a duplicate`, () => {
    const prev = { id: "100_x", concept: "## 핵심 메시지\n완전히 같은 문장입니다.", narration: "" };
    expect(compareConcepts("## 핵심 메시지\n완전히 같은 문장입니다.", prev).duplicate).toBe(true);
  });
});

describe("findConceptOverlap", () => {
  it("checks the new episode against every earlier one and names the similar episode", () => {
    const r = findConceptOverlap(PROJECTS_DIR, "009_two_touches");
    expect(r?.similarTo).toBe("008_ai_visual");
  });

  it("returns null for an episode with no earlier match", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overlap-"));
    try {
      for (const [id, text] of [["001_a", "## 핵심 메시지\n고양이가 3마리 있다."], ["002_b", "## 핵심 메시지\n자전거로 40킬로미터를 달렸다."]]) {
        fs.mkdirSync(path.join(dir, id));
        fs.writeFileSync(path.join(dir, id, "concept.md"), text);
      }
      expect(findConceptOverlap(dir, "002_b")).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
