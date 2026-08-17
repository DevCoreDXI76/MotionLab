import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Cast } from "../lib/cast";
import { renderCastAt, scaleCastToDuration, tailLines } from "../lib/cast";

export interface CastTerminalProps {
  cast: Cast;
  durationInFrames: number;
  maxLines?: number;
}

const DEFAULT_MAX_LINES = 18;
const CURSOR_BLINK_HZ = 2;

/**
 * Plays back a cast-builder Cast (real captured command output, synthetic
 * timing — see src/lib/cast.ts) as a live-growing terminal buffer, scaled
 * to fill the scene's actual duration exactly. Scrolls like a real
 * terminal: once the buffer exceeds `maxLines`, only the tail is shown.
 */
export const CastTerminal: React.FC<CastTerminalProps> = ({ cast, durationInFrames, maxLines = DEFAULT_MAX_LINES }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaled = useMemo(
    () => scaleCastToDuration(cast, durationInFrames / fps),
    [cast, durationInFrames, fps],
  );

  const visible = renderCastAt(scaled, frame / fps);
  const shown = tailLines(visible, maxLines);
  const cursorOn = Math.floor(frame / (fps / (CURSOR_BLINK_HZ * 2))) % 2 === 0;

  return (
    <pre
      style={{
        fontFamily: "Consolas, monospace",
        fontSize: 42,
        lineHeight: 1.45,
        color: "#d4d4d4",
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {shown}
      <span style={{ opacity: cursorOn ? 1 : 0, color: "#8ab4f8" }}>▌</span>
    </pre>
  );
};
