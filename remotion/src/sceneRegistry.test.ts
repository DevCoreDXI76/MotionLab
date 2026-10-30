import { describe, expect, it } from "vitest";
import { resolveSceneComponent } from "./sceneRegistry";
import { TitleScene } from "./components/scenes/TitleScene";
import { DiagramScene } from "./components/scenes/DiagramScene";

describe("resolveSceneComponent", () => {
  it("maps known scene types to their component", () => {
    expect(resolveSceneComponent("title")).toBe(TitleScene);
    expect(resolveSceneComponent("diagram")).toBe(DiagramScene);
  });

  it("throws on an unknown scene type", () => {
    expect(() => resolveSceneComponent("nope")).toThrow(/Unknown scene type/);
  });
});
