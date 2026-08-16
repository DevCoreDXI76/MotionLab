import { describe, expect, it } from "vitest";
import { resolveMotionVariant } from "./resolveMotionVariant";

describe("resolveMotionVariant", () => {
  it("uses the cue when it matches a known variant", () => {
    expect(resolveMotionVariant("checklist", "title")).toBe("checklist");
  });

  it("falls back to the scene type's default when cue is null", () => {
    expect(resolveMotionVariant(null, "title")).toBe("terminal");
    expect(resolveMotionVariant(null, "talkingPoint")).toBe("checklist");
    expect(resolveMotionVariant(null, "outro")).toBe("pulse");
  });

  it("falls back to the scene type's default when cue is unrecognized", () => {
    expect(resolveMotionVariant("not-a-real-variant", "talkingPoint")).toBe("checklist");
  });

  it("falls back to pipeline for an unknown scene type with no cue", () => {
    expect(resolveMotionVariant(undefined, "code")).toBe("pipeline");
    expect(resolveMotionVariant(undefined, "somethingElse")).toBe("pipeline");
  });
});
