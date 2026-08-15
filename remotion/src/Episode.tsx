import React from "react";
import { Series } from "remotion";
import { resolveSceneComponent } from "./sceneRegistry";

export type Scene = {
  id: string;
  type: string;
  narration: string;
  subtitleText?: string | null;
  durationMs?: number | null;
  audioPath?: string | null;
  props?: Record<string, unknown>;
};

export type EpisodeProps = {
  id: string;
  title: string;
  format: "shorts" | "long";
  fps: number;
  width?: number;
  height?: number;
  scenes: Scene[];
};

const FALLBACK_DURATION_MS = 3000; // Studio 프리뷰에서 duration 역주입 전에도 렌더가 깨지지 않도록 하는 임시값

export const Episode: React.FC<EpisodeProps> = ({ scenes, fps }) => {
  return (
    <Series>
      {scenes.map((scene) => {
        const durationMs = scene.durationMs ?? FALLBACK_DURATION_MS;
        const durationInFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
        const SceneComponent = resolveSceneComponent(scene.type);
        return (
          <Series.Sequence key={scene.id} durationInFrames={durationInFrames}>
            <SceneComponent
              narration={scene.narration}
              subtitleText={scene.subtitleText ?? scene.narration}
              audioSrc={scene.audioPath ?? ""}
              props={scene.props ?? {}}
            />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};
