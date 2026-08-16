import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { CentralVisual } from "../CentralVisual";
import { FONT_FAMILY } from "../../theme";
import type { SceneProps } from "./types";

export interface OutroSceneProps {
  message: string;
  ctaText?: string;
}

export const OutroScene: React.FC<SceneProps<OutroSceneProps>> = ({
  subtitleText,
  audioSrc,
  durationInFrames,
  visual,
  props,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#111",
        color: "#fff",
        fontFamily: FONT_FAMILY,
        opacity,
      }}
    >
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <div style={{ flexShrink: 0, padding: "90px 60px 0", textAlign: "center" }}>
        <h1 style={{ fontSize: 56 }}>{props.message}</h1>
        {props.ctaText ? <h3 style={{ fontSize: 32, color: "#8ab4f8" }}>{props.ctaText}</h3> : null}
      </div>
      <div style={{ flexBasis: "42%", flexGrow: 1, minHeight: 0, position: "relative" }}>
        <CentralVisual visual={visual} durationInFrames={durationInFrames} sceneType="outro" />
      </div>
      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
