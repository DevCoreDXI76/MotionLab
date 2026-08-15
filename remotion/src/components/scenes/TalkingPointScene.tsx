import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import type { SceneProps } from "./types";

export interface TalkingPointSceneProps {
  heading: string;
  bullets: string[];
}

export const TalkingPointScene: React.FC<SceneProps<TalkingPointSceneProps>> = ({
  subtitleText,
  audioSrc,
  props,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1117", padding: 80, color: "#fff" }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <h2 style={{ fontSize: 56 }}>{props.heading}</h2>
      <ul style={{ fontSize: 40, lineHeight: 1.6 }}>
        {props.bullets.map((bullet, i) => {
          const delay = i * fps * 0.4;
          const opacity = interpolate(frame, [delay, delay + fps * 0.3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const translateX = interpolate(frame, [delay, delay + fps * 0.3], [-40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <li key={i} style={{ opacity, transform: `translateX(${translateX}px)` }}>
              {bullet}
            </li>
          );
        })}
      </ul>
      <SubtitleOverlay text={subtitleText} />
    </AbsoluteFill>
  );
};
