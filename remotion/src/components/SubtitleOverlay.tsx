import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { splitSubtitleLines } from "../lib/splitSubtitleLines";
import { FONT_FAMILY } from "../theme";

const FADE_FRAMES = 6;

export interface SubtitleOverlayProps {
  text: string;
  /** Scene's total duration in frames — used to split `text` into sentence-level lines. */
  durationInFrames: number;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  if (!text) return null;

  const lines = splitSubtitleLines(text, durationInFrames);
  const active = lines.find((line) => frame >= line.startFrame && frame < line.endFrame) ?? lines[lines.length - 1];
  if (!active) return null;

  const span = active.endFrame - active.startFrame;
  const opacity =
    span > FADE_FRAMES * 2
      ? interpolate(
          frame,
          [active.startFrame, active.startFrame + FADE_FRAMES, active.endFrame - FADE_FRAMES, active.endFrame],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 120 }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "12px 24px",
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 40,
          fontFamily: FONT_FAMILY,
          textAlign: "center",
          opacity,
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};
