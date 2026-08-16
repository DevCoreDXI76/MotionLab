import React from "react";
import { KenBurnsImage } from "./KenBurnsImage";
import { MotionGraphic } from "./motionGraphics/MotionGraphic";
import { resolveMotionVariant } from "../lib/resolveMotionVariant";

export interface VisualCue {
  cue?: string | null;
  assetPath?: string | null;
  focal?: "center" | "top" | "bottom" | "left" | "right" | null;
}

export interface CentralVisualProps {
  visual?: VisualCue | null;
  durationInFrames: number;
  /** The owning scene's type (e.g. "title") — used to pick a default motion-graphic variant. */
  sceneType: string;
}

/**
 * Fills the middle band between a scene's text and its subtitle overlay.
 *
 * Single source of truth for "what to show": `visual.assetPath` present ->
 * real image with Ken Burns pan/zoom. Otherwise -> a code-based motion
 * graphic (no `kind` flag to keep in sync — there's nothing to fall out of
 * sync with). This lets a future screenshot/stock/AI-image pipeline just
 * populate `assetPath` without any other change here.
 */
export const CentralVisual: React.FC<CentralVisualProps> = ({ visual, durationInFrames, sceneType }) => {
  if (visual?.assetPath) {
    return (
      <KenBurnsImage assetPath={visual.assetPath} durationInFrames={durationInFrames} focal={visual.focal} />
    );
  }
  const variant = resolveMotionVariant(visual?.cue, sceneType);
  return <MotionGraphic variant={variant} durationInFrames={durationInFrames} />;
};
