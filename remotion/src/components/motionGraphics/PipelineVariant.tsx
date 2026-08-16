import React, { Fragment } from "react";
import { useCurrentFrame } from "remotion";
import { FONT_FAMILY } from "../../theme";

const NODES = ["대본", "TTS", "렌더"];
const ACCENT = "#8ab4f8";

/** Three pipeline stages, lit up in sequence as the scene progresses. Default variant. */
export const PipelineVariant: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const progress = durationInFrames > 0 ? frame / durationInFrames : 0;
  const activeIndex = Math.min(NODES.length - 1, Math.floor(progress * NODES.length));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      {NODES.map((label, i) => (
        <Fragment key={label}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_FAMILY,
              fontSize: 28,
              color: i === activeIndex ? "#0d1117" : "#fff",
              backgroundColor: i === activeIndex ? ACCENT : "rgba(255,255,255,0.08)",
              border: `2px solid ${ACCENT}`,
            }}
          >
            {label}
          </div>
          {i < NODES.length - 1 ? (
            <div
              style={{
                width: 40,
                height: 4,
                backgroundColor: i < activeIndex ? ACCENT : "rgba(255,255,255,0.2)",
              }}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
};
