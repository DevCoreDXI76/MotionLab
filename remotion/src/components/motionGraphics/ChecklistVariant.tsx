import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY } from "../../theme";

const ITEMS = ["대본 생성", "TTS 합성", "자동 렌더"];
const ACCENT = "#8ab4f8";

/** Checkmarks popping in one at a time across the scene's duration. */
export const ChecklistVariant: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {ITEMS.map((label, i) => {
        const revealFrame = Math.round((durationInFrames * (i + 1)) / (ITEMS.length + 1));
        const opacity = interpolate(frame, [revealFrame, revealFrame + fps * 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const scale = interpolate(frame, [revealFrame, revealFrame + fps * 0.3], [0.6, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 16, opacity, transform: `scale(${scale})` }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: ACCENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0d1117",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <span style={{ fontFamily: FONT_FAMILY, fontSize: 32, color: "#fff" }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};
