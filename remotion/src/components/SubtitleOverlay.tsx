import React from "react";
import { AbsoluteFill } from "remotion";

export const SubtitleOverlay: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
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
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
