import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { FONT_FAMILY } from "../../theme";
import type { SceneProps } from "./types";

export interface CodeSceneProps {
  language: string;
  code: string;
  caption?: string;
}

export const CodeScene: React.FC<SceneProps<CodeSceneProps>> = ({
  subtitleText,
  audioSrc,
  durationInFrames,
  props,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1e1e1e", padding: 60, color: "#d4d4d4", fontFamily: FONT_FAMILY }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      {props.caption ? <p style={{ fontSize: 32, color: "#9cdcfe" }}>{props.caption}</p> : null}
      <pre style={{ fontFamily: "Consolas, monospace", fontSize: 34, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        <code>{props.code}</code>
      </pre>
      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
