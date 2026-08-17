import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

export interface VideoBackgroundProps {
  assetPath: string;
}

/**
 * Full-bleed muted video b-roll (e.g. a real Remotion Studio recording —
 * see scripts note in docs/remotion_트레이드오프_claudecode인계.md 항목 15,
 * "① Remotion Studio 동작 화면"). Muted because the scene's own TTS
 * narration audio is the only audio track that should play; plays once for
 * its natural length rather than looping — if it's shorter than the scene,
 * the background simply holds rather than repeating awkwardly mid-scene.
 */
export const VideoBackground: React.FC<VideoBackgroundProps> = ({ assetPath }) => {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(assetPath)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};
