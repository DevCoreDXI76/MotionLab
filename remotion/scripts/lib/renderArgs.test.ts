import { describe, expect, it } from "vitest";
import { buildRenderArgs } from "./renderArgs";

describe("buildRenderArgs", () => {
  it("keeps 2D-only episodes on the default GL backend (001~007 unchanged)", () => {
    expect(buildRenderArgs({ scenes: [{ type: "title" }, { type: "code" }] }, "s.json", "o.mp4")).toEqual([
      "remotion", "render", "src/index.ts", "Episode", "o.mp4", "--props=s.json",
    ]);
  });

  it("adds --gl=angle when the episode has a 3D diagram scene", () => {
    expect(buildRenderArgs({ scenes: [{ type: "title" }, { type: "diagram" }] }, "s.json", "o.mp4")).toContain("--gl=angle");
  });
});
