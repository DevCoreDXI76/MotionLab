import { describe, expect, it } from "vitest";
import { buildCast, castDurationSeconds, renderCastAt, scaleCastToDuration, tailLines } from "./cast";

describe("buildCast", () => {
  it("types an input segment out one character at a time, ending with a newline", () => {
    const cast = buildCast([{ kind: "input", text: "ab" }], { width: 80, height: 24 });
    const chars = cast.events.map((e) => e.data);
    expect(chars).toEqual(["a", "b", "\r\n"]);
  });

  it("reveals an output segment as a single block after a pause, followed by a line break", () => {
    const cast = buildCast([{ kind: "output", text: "hello\nworld" }], { width: 80, height: 24 });
    expect(cast.events).toHaveLength(2);
    expect(cast.events[0].data).toBe("hello\nworld");
    expect(cast.events[0].time).toBeGreaterThan(0);
    expect(cast.events[1].data).toBe("\r\n");
  });

  it("produces strictly non-decreasing event times across mixed segments", () => {
    const cast = buildCast(
      [
        { kind: "input", text: "npx vitest run" },
        { kind: "output", text: "9 passed" },
      ],
      { width: 80, height: 24 },
    );
    for (let i = 1; i < cast.events.length; i++) {
      expect(cast.events[i].time).toBeGreaterThanOrEqual(cast.events[i - 1].time);
    }
  });

  it("carries the given width/height into the header", () => {
    const cast = buildCast([], { width: 120, height: 30 });
    expect(cast.header).toEqual({ version: 2, width: 120, height: 30, timestamp: 0 });
  });
});

describe("castDurationSeconds", () => {
  it("returns 0 for an empty cast", () => {
    expect(castDurationSeconds({ header: { version: 2, width: 80, height: 24, timestamp: 0 }, events: [] })).toBe(0);
  });

  it("returns the last event's time", () => {
    const cast = buildCast([{ kind: "input", text: "hi" }], { width: 80, height: 24 });
    expect(castDurationSeconds(cast)).toBe(cast.events[cast.events.length - 1].time);
  });
});

describe("scaleCastToDuration", () => {
  it("rescales so the cast's total duration matches the target exactly", () => {
    const cast = buildCast(
      [
        { kind: "input", text: "npx vitest run" },
        { kind: "output", text: "9 passed (9)" },
      ],
      { width: 80, height: 24 },
    );
    const scaled = scaleCastToDuration(cast, 5);
    expect(castDurationSeconds(scaled)).toBeCloseTo(5, 5);
  });

  it("preserves relative event ordering after scaling", () => {
    const cast = buildCast([{ kind: "input", text: "abc" }], { width: 80, height: 24 });
    const scaled = scaleCastToDuration(cast, 10);
    for (let i = 1; i < scaled.events.length; i++) {
      expect(scaled.events[i].time).toBeGreaterThanOrEqual(scaled.events[i - 1].time);
    }
  });

  it("is a no-op when the original cast has zero duration", () => {
    const empty = { header: { version: 2 as const, width: 80, height: 24, timestamp: 0 }, events: [] };
    expect(scaleCastToDuration(empty, 5)).toEqual(empty);
  });
});

describe("renderCastAt", () => {
  it("returns an empty string before the first event", () => {
    const cast = buildCast([{ kind: "input", text: "ab" }], { width: 80, height: 24 });
    expect(renderCastAt(cast, -1)).toBe("");
  });

  it("accumulates all event data up to and including the given time", () => {
    const cast = buildCast([{ kind: "input", text: "ab" }], { width: 80, height: 24 });
    const full = renderCastAt(cast, castDurationSeconds(cast));
    expect(full).toBe("ab\r\n");
  });

  it("shows a partial buffer mid-way through typing", () => {
    const cast = buildCast([{ kind: "input", text: "abcde" }], { width: 80, height: 24 });
    const midTime = cast.events[2].time; // after "a","b","c"
    expect(renderCastAt(cast, midTime)).toBe("abc");
  });
});

describe("tailLines", () => {
  it("returns the text unchanged when it has fewer lines than the cap", () => {
    expect(tailLines("a\nb", 5)).toBe("a\nb");
  });

  it("keeps only the last N lines when over the cap", () => {
    expect(tailLines("1\n2\n3\n4\n5", 2)).toBe("4\n5");
  });
});
