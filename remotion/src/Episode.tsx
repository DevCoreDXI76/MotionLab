import React from "react";
import { Series, getRemotionEnvironment } from "remotion";
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

const FALLBACK_DURATION_MS = 3000; // Studio 프리뷰 전용: duration 역주입 전에도 편집 화면이 깨지지 않도록 하는 임시값

export const Episode: React.FC<EpisodeProps> = ({ scenes, fps }) => {
  return (
    <Series>
      {scenes.map((scene) => {
        let durationMs = scene.durationMs;
        if (durationMs == null) {
          if (getRemotionEnvironment().isStudio) {
            durationMs = FALLBACK_DURATION_MS;
          } else {
            throw new Error(`Scene "${scene.id}" has no durationMs — run generate-narration before rendering.`);
          }
        }
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
