import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { StackDiagram } from "../three/StackDiagram";
import { FONT_FAMILY } from "../../theme";
import type { SceneProps } from "./types";

export interface DiagramSceneProps {
  heading: string;
  preset?: "stack";
  labels: string[];
  highlight?: number;
  accent?: string;
}

/**
 * Full-frame 3D structure scene (docs/2단계_설계.md D1): the 3D stack fills the frame — the 008
 * spike tuned its camera and label projection for full 1080x1920 — with the heading on top and
 * subtitles below. Ignores `visual`: there is no CentralVisual band in this scene.
 */
export const DiagramScene: React.FC<SceneProps<DiagramSceneProps>> = ({
  subtitleText,
  audioSrc,
  durationInFrames,
  props,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headingOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{ background: "radial-gradient(ellipse at 50% 40%, #0f1b33 0%, #05080f 70%)", fontFamily: FONT_FAMILY }}
    >
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <StackDiagram labels={props.labels} highlight={props.highlight} accent={props.accent} />
      <h2
        style={{
          position: "absolute",
          top: 90,
          left: 60,
          right: 60,
          margin: 0,
          textAlign: "center",
          color: "#fff",
          fontSize: 60,
          opacity: headingOpacity,
        }}
      >
        {props.heading}
      </h2>
      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
