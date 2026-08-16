import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

export interface KenBurnsImageProps {
  assetPath: string;
  durationInFrames: number;
  focal?: "center" | "top" | "bottom" | "left" | "right" | null;
}

const FOCAL_POSITION: Record<string, string> = {
  center: "center",
  top: "center top",
  bottom: "center bottom",
  left: "left center",
  right: "right center",
};

/**
 * Slow pan/zoom over a static image, scaled to the scene's own duration so
 * it reads the same whether the scene is 5s or 18s. Remotion's core (4.0.512
 * here) exports `Img` for still images — there is no `OffthreadImage` in
 * this version (that's video-only, as `OffthreadVideo`).
 *
 * `assetPath` is a public/-relative path (same convention as audioPath —
 * see injectDurations.ts), resolved via staticFile() like the existing
 * Audio usage in the scene components.
 */
export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({ assetPath, durationInFrames, focal }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(assetPath)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: FOCAL_POSITION[focal ?? "center"] ?? "center",
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};
