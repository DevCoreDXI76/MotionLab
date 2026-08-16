import React from "react";
import { AbsoluteFill } from "remotion";
import type { MotionVariant } from "../../lib/resolveMotionVariant";
import { PipelineVariant } from "./PipelineVariant";
import { TerminalVariant } from "./TerminalVariant";
import { ChecklistVariant } from "./ChecklistVariant";
import { PulseVariant } from "./PulseVariant";

export interface MotionGraphicProps {
  variant: MotionVariant;
  durationInFrames: number;
}

// Registry pattern mirrors sceneRegistry.ts (scene.type -> component).
// Kept to 3-4 entries deliberately — see resolveMotionVariant.ts.
const VARIANTS: Record<MotionVariant, React.FC<{ durationInFrames: number }>> = {
  pipeline: PipelineVariant,
  terminal: TerminalVariant,
  checklist: ChecklistVariant,
  pulse: PulseVariant,
};

/** Code-based motion graphic shown in CentralVisual when no image asset is available. */
export const MotionGraphic: React.FC<MotionGraphicProps> = ({ variant, durationInFrames }) => {
  const Variant = VARIANTS[variant] ?? VARIANTS.pipeline;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Variant durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
