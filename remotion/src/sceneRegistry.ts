import type React from "react";
import { TitleScene } from "./components/scenes/TitleScene";
import { TalkingPointScene } from "./components/scenes/TalkingPointScene";
import { CodeScene } from "./components/scenes/CodeScene";
import { OutroScene } from "./components/scenes/OutroScene";
import type { SceneProps } from "./components/scenes/types";

export const sceneRegistry: Record<string, React.FC<SceneProps<any>>> = {
  title: TitleScene,
  talkingPoint: TalkingPointScene,
  code: CodeScene,
  outro: OutroScene,
};

export function resolveSceneComponent(type: string): React.FC<SceneProps<any>> {
  const component = sceneRegistry[type];
  if (!component) {
    throw new Error(`Unknown scene type: ${type}`);
  }
  return component;
}
