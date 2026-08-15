import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { FONT_FAMILY } from "../../theme";
import type { SceneProps } from "./types";

export interface TitleSceneProps {
  title: string;
  subtitle?: string;
}

export const TitleScene: React.FC<SceneProps<TitleSceneProps>> = ({
  subtitleText,
  audioSrc,
  durationInFrames,
  props,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 10, stiffness: 180 } });
  const opacity = interpolate(frame, [0, fps / 2], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{ backgroundColor: "#111", justifyContent: "center", alignItems: "center", fontFamily: FONT_FAMILY }}
    >
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <div style={{ transform: `scale(${scale})`, opacity, textAlign: "center", color: "#fff" }}>
        <h1 style={{ fontSize: 72, margin: 0 }}>{props.title}</h1>
        {props.subtitle ? <h2 style={{ fontSize: 36, fontWeight: 400 }}>{props.subtitle}</h2> : null}
      </div>
      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
