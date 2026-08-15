import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { FONT_FAMILY } from "../../theme";
import type { SceneProps } from "./types";

export interface TalkingPointSceneProps {
  heading: string;
  bullets: string[];
}

// 불릿 등장 전에 heading이 먼저 들어오는 시퀀스를 명확히 하기 위한 오프셋.
const BULLET_START_OFFSET_SEC = 0.2;

export const TalkingPointScene: React.FC<SceneProps<TalkingPointSceneProps>> = ({
  subtitleText,
  audioSrc,
  durationInFrames,
  props,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headingTranslateY = interpolate(frame, [0, fps * 0.3], [-20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1117", padding: 80, color: "#fff", fontFamily: FONT_FAMILY }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <h2 style={{ fontSize: 56, opacity: headingOpacity, transform: `translateY(${headingTranslateY}px)` }}>
        {props.heading}
      </h2>
      <ul style={{ fontSize: 40, lineHeight: 1.6 }}>
        {props.bullets.map((bullet, i) => {
          const delay = fps * BULLET_START_OFFSET_SEC + i * fps * 0.4;
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
      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
