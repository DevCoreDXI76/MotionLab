import React from "react";
import { Composition, getRemotionEnvironment } from "remotion";
import { Episode, EpisodeProps } from "./Episode";

const FALLBACK_DURATION_MS = 3000; // Studio 프리뷰 전용: duration 역주입 전에도 편집 화면이 깨지지 않도록 하는 임시값

const DEFAULT_DIMENSIONS: Record<EpisodeProps["format"], { width: number; height: number }> = {
  shorts: { width: 1080, height: 1920 },
  long: { width: 1920, height: 1080 },
};

const SAMPLE_PROPS: EpisodeProps = {
  id: "preview",
  title: "미리보기",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "모션랩 파이프라인 미리보기", props: { title: "MotionLab" } },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Episode"
      component={Episode}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={90}
      defaultProps={SAMPLE_PROPS}
      calculateMetadata={async ({ props }) => {
        const format = props.format ?? "shorts";
        const dims = DEFAULT_DIMENSIONS[format];
        const fps = props.fps ?? 30;
        const durationInFrames = props.scenes.reduce((sum: number, scene) => {
          let durationMs = scene.durationMs;
          if (durationMs == null) {
            if (getRemotionEnvironment().isStudio) {
              durationMs = FALLBACK_DURATION_MS;
            } else {
              throw new Error(`Scene "${scene.id}" has no durationMs — run generate-narration before rendering.`);
            }
          }
          return sum + Math.max(1, Math.round((durationMs / 1000) * fps));
        }, 0);
        return {
          width: props.width ?? dims.width,
          height: props.height ?? dims.height,
          fps,
          durationInFrames,
        };
      }}
    />
  );
};
