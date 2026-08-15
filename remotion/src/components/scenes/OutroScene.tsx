import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
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
  props,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#111",
        justifyContent: "center",
        alignItems: "center",
        color: "#fff",
        fontFamily: FONT_FAMILY,
        opacity,
      }}
    >
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 56 }}>{props.message}</h1>
        {props.ctaText ? <h3 style={{ fontSize: 32, color: "#8ab4f8" }}>{props.ctaText}</h3> : null}
      </div>
      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
