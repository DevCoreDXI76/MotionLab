import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

const COMMAND = "npx tsx scripts/render.ts";
const WINDOW_DOT_COLORS = ["#ff5f56", "#ffbd2e", "#27c93f"];

/** A terminal window mockup that "types out" a render command. */
export const TerminalVariant: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Finish typing by 60% through the scene, then hold with a blinking cursor.
  const typingWindow = Math.max(1, durationInFrames * 0.6);
  const progress = Math.min(1, frame / typingWindow);
  const visibleChars = Math.floor(progress * COMMAND.length);
  const cursorOn = Math.floor(frame / (fps / 2)) % 2 === 0;

  return (
    <div style={{ width: 480, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
      <div style={{ display: "flex", gap: 8, padding: "10px 14px", backgroundColor: "#2d2d2d" }}>
        {WINDOW_DOT_COLORS.map((color) => (
          <div key={color} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: color }} />
        ))}
      </div>
      <div
        style={{
          backgroundColor: "#1e1e1e",
          padding: 20,
          fontFamily: "Consolas, monospace",
          fontSize: 24,
          color: "#9cdcfe",
          minHeight: 60,
        }}
      >
        {"$ " + COMMAND.slice(0, visibleChars)}
        <span style={{ opacity: cursorOn ? 1 : 0 }}>▌</span>
      </div>
    </div>
  );
};
