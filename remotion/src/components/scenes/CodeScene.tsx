import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { CastTerminal } from "../CastTerminal";
import { splitSubtitleLines } from "../../lib/splitSubtitleLines";
import { mapBulletsToStartFrames } from "../../lib/mapBulletsToStartFrames";
import type { Cast } from "../../lib/cast";
import { FONT_FAMILY } from "../../theme";
import type { SceneProps } from "./types";

export interface CodeSceneProps {
  language: string;
  code: string;
  caption?: string;
  /**
   * Real, non-interactively captured command output with synthetic timing —
   * see src/lib/cast.ts and scripts/generate-terminal-cast.ts. When present,
   * this drives the terminal body instead of the static `code` text (Type A
   * visual grammar: real output, not an authored mockup). `code` stays as
   * the schema-required fallback for scenes without a cast.
   */
  cast?: Cast;
}

const ACCENT = "#8ab4f8";
const WINDOW_DOT_COLORS = ["#ff5f56", "#ffbd2e", "#27c93f"];
const MIN_DELAY_SEC = 0.3;

/**
 * "Type A/B" visual grammar (docs/002_test_리뷰_개선백로그.md): the code IS the
 * full-bleed background — not a small card floating on empty space — with a
 * slow punch-in zoom and a highlight that steps through each command block as
 * the narration reaches it. Blocks are separated by blank lines in `code`
 * (matches how script.json's code prop is already authored) and mapped to
 * narration-sentence start frames via the same mapBulletsToStartFrames used
 * for TalkingPointScene's bullets — a highlight "step" is really the same
 * problem as a bullet reveal, just rendered as emphasis instead of fade-in.
 */
export const CodeScene: React.FC<SceneProps<CodeSceneProps>> = ({
  subtitleText,
  audioSrc,
  durationInFrames,
  props,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const codeBlocks = useMemo(() => props.code.split(/\n\s*\n/), [props.code]);

  const blockStartFrames = useMemo(() => {
    const lines = splitSubtitleLines(subtitleText, durationInFrames);
    return mapBulletsToStartFrames(codeBlocks, lines, Math.round(fps * MIN_DELAY_SEC));
  }, [subtitleText, durationInFrames, codeBlocks, fps]);

  let activeBlock = 0;
  for (let i = 0; i < blockStartFrames.length; i++) {
    if (frame >= blockStartFrames[i]) activeBlock = i;
  }

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: "clamp" });
  const cursorOn = Math.floor(frame / (fps / 2)) % 2 === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d", overflow: "hidden" }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}

      <AbsoluteFill
        style={{
          transform: `scale(${zoom})`,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1e1e1e",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "26px 40px", backgroundColor: "#2d2d2d" }}>
          {WINDOW_DOT_COLORS.map((color) => (
            <div key={color} style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: color }} />
          ))}
          <div style={{ color: "#8b949e", fontFamily: "Consolas, monospace", fontSize: 26, marginLeft: 14 }}>
            terminal — motionlab
          </div>
        </div>

        <div style={{ flex: 1, padding: "56px 48px", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
          {props.cast ? (
            <CastTerminal cast={props.cast} durationInFrames={durationInFrames} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {codeBlocks.map((block, i) => {
                const isActive = i === activeBlock;
                return (
                  <div
                    key={i}
                    style={{
                      borderLeft: `6px solid ${isActive ? ACCENT : "transparent"}`,
                      backgroundColor: isActive ? "rgba(138,180,248,0.12)" : "transparent",
                      borderRadius: 8,
                      padding: "18px 24px",
                    }}
                  >
                    <pre
                      style={{
                        fontFamily: "Consolas, monospace",
                        fontSize: 46,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        color: isActive ? "#f0f6fc" : "#8b949e",
                        margin: 0,
                      }}
                    >
                      <code>
                        {block}
                        {isActive && i === codeBlocks.length - 1 ? (
                          <span style={{ opacity: cursorOn ? 1 : 0, color: ACCENT }}>▌</span>
                        ) : null}
                      </code>
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AbsoluteFill>

      {props.caption ? (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 56 }}>
          <div
            style={{
              maxWidth: "85%",
              padding: "12px 28px",
              borderRadius: 12,
              backgroundColor: "rgba(13,13,13,0.75)",
              border: `1px solid ${ACCENT}`,
              color: "#9cdcfe",
              fontFamily: FONT_FAMILY,
              fontSize: 28,
              textAlign: "center",
            }}
          >
            {props.caption}
          </div>
        </AbsoluteFill>
      ) : null}

      <SubtitleOverlay text={subtitleText} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
