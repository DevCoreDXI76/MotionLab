import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { CentralVisual } from "../CentralVisual";
import { splitSubtitleLines } from "../../lib/splitSubtitleLines";
import { mapBulletsToStartFrames } from "../../lib/mapBulletsToStartFrames";
import { FONT_FAMILY } from "../../theme";
import type { SceneProps } from "./types";

export interface TalkingPointSceneProps {
  heading: string;
  bullets: string[];
}

// 불릿 등장 전에 heading이 먼저 들어오는 시퀀스를 명확히 하기 위한 최소 지연.
// 문장 타이밍 매핑이 프레임 0 근처를 반환할 때의 하한으로도 재사용된다(mapBulletsToStartFrames).
const BULLET_MIN_DELAY_SEC = 0.2;

export const TalkingPointScene: React.FC<SceneProps<TalkingPointSceneProps>> = ({
  subtitleText,
  audioSrc,
  durationInFrames,
  visual,
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

  // 불릿 등장을 고정 간격이 아니라 실제 나레이션 문장이 시작되는 시점에 맞춘다 —
  // subtitleText(기본은 scene narration)를 문장 단위로 쪼갠 뒤 불릿 개수와 매핑.
  const bulletDelays = useMemo(() => {
    const lines = splitSubtitleLines(subtitleText, durationInFrames);
    return mapBulletsToStartFrames(props.bullets, lines, Math.round(fps * BULLET_MIN_DELAY_SEC));
  }, [subtitleText, durationInFrames, props.bullets, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1117", padding: 80, color: "#fff", fontFamily: FONT_FAMILY }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <h2 style={{ fontSize: 56, opacity: headingOpacity, transform: `translateY(${headingTranslateY}px)` }}>
        {props.heading}
      </h2>
      <ul style={{ fontSize: 40, lineHeight: 1.6 }}>
        {props.bullets.map((bullet, i) => {
          const delay = bulletDelays[i];
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
      <div style={{ flexBasis: "42%", flexGrow: 1, minHeight: 0, position: "relative" }}>
        <CentralVisual visual={visual} durationInFrames={durationInFrames} sceneType="talkingPoint" />
      </div>
      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
