import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

const ACCENT = "#8ab4f8";

/** A slow, looping glow pulse — generic fallback, used as the outro default. */
export const PulseVariant: React.FC<{ durationInFrames: number }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // ~2s pulse period
  const scale = 1 + 0.12 * Math.sin(t * Math.PI);
  const glowOpacity = 0.35 + 0.25 * Math.sin(t * Math.PI);

  return (
    <div style={{ width: 200, height: 200, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          backgroundColor: ACCENT,
          opacity: glowOpacity,
          filter: "blur(20px)",
          transform: `scale(${scale * 1.3})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 30,
          borderRadius: "50%",
          backgroundColor: ACCENT,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
};
