import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { PerspectiveCamera, Vector3 } from "three";
import { FONT_FAMILY } from "../../theme";

// Generalized from the 008 spike (src/spike/SpikeC.tsx, experiment C): one block per label drops in
// and stacks while the world slowly orbits. Labels are 2D text placed at the blocks' projected
// screen positions, not 3D text — readable text stays a Remotion overlay (backlog 2).
// Render with --gl=angle (render.ts adds it whenever an episode has a diagram scene — D3).

const BLOCK = { w: 3.2, h: 0.5, d: 1.6, gap: 0.1 };
const DROP_START = 6;
const DROP_EVERY = 14;
const DROP_HEIGHT = 3;
const CAMERA = { fov: 38, position: [0, 4.6, 13] as const, tilt: -Math.atan2(4.6 - 2.1, 13) };

export const DEFAULT_ACCENT = "#2f7bff";

export interface StackDiagramProps {
  labels: string[];
  /** Block that stays lit once everything has landed; defaults to the last one. */
  highlight?: number;
  accent?: string;
}

const restY = (i: number) => BLOCK.h / 2 + i * (BLOCK.h + BLOCK.gap);

// 0 → 1 as block i lands; shared by the 3D mesh and its 2D label so they move together.
const useLanding = (i: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - (DROP_START + i * DROP_EVERY), fps, config: { damping: 14, mass: 0.6 } });
};

const Block: React.FC<{ i: number; lit: boolean; accent: string }> = ({ i, lit, accent }) => {
  const p = useLanding(i);
  if (p <= 0.001) return null;
  return (
    <mesh position={[0, restY(i) + (1 - p) * DROP_HEIGHT, 0]}>
      <boxGeometry args={[BLOCK.w, BLOCK.h, BLOCK.d]} />
      <meshStandardMaterial
        color="#16233a"
        metalness={0.35}
        roughness={0.35}
        emissive={accent}
        emissiveIntensity={lit ? 0.35 : 0.08}
        transparent
        opacity={Math.min(1, p * 1.5)}
      />
    </mesh>
  );
};

const litIndex = (frame: number, count: number, highlight: number | undefined) => {
  const latest = Math.floor((frame - DROP_START) / DROP_EVERY);
  if (latest < count - 1) return latest;
  return highlight != null && highlight >= 0 && highlight < count ? highlight : count - 1;
};

const Scene: React.FC<{ count: number; lit: number; accent: string }> = ({ count, lit, accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Orbit = rotate the whole world (blocks + lights) the other way; identical on screen to moving the camera.
  const orbit = interpolate(frame, [0, durationInFrames], [0.55, -0.55]);
  return (
    <group rotation={[0, orbit, 0]}>
      <ambientLight intensity={0.25} color="#8fb4ff" />
      <directionalLight position={[4, 8, 6]} intensity={1.6} color="#9cc3ff" />
      <pointLight position={[-3, 2, 4]} intensity={18} color={accent} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[5, 48]} />
        <meshStandardMaterial color="#0b1220" roughness={0.9} />
      </mesh>
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} i={i} lit={i === lit} accent={accent} />
      ))}
    </group>
  );
};

const Label: React.FC<{ i: number; text: string; lit: boolean; camera: PerspectiveCamera; accent: string }> = ({
  i,
  text,
  lit,
  camera,
  accent,
}) => {
  const { width, height } = useVideoConfig();
  const p = useLanding(i);
  if (p <= 0.001) return null;
  // Block centres sit on the orbit axis, so their projection does not depend on the orbit angle.
  const v = new Vector3(0, restY(i) + (1 - p) * DROP_HEIGHT, BLOCK.d / 2).project(camera);
  return (
    <div
      style={{
        position: "absolute",
        left: ((v.x + 1) / 2) * width,
        top: ((1 - v.y) / 2) * height,
        transform: "translate(-50%, -50%)",
        opacity: Math.min(1, p * 1.5),
        color: lit ? "#ffffff" : "#e6f0ff",
        fontFamily: FONT_FAMILY,
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: 1,
        whiteSpace: "nowrap",
        textShadow: `0 0 18px ${accent}cc`,
      }}
    >
      {`${i + 1}. ${text}`}
    </div>
  );
};

export const StackDiagram: React.FC<StackDiagramProps> = ({ labels, highlight, accent = DEFAULT_ACCENT }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const camera = useMemo(() => {
    const c = new PerspectiveCamera(CAMERA.fov, width / height, 0.1, 100);
    c.position.set(...CAMERA.position);
    c.rotation.set(CAMERA.tilt, 0, 0);
    c.updateMatrixWorld();
    c.updateProjectionMatrix();
    return c;
  }, [width, height]);
  const lit = litIndex(frame, labels.length, highlight);
  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 100, position: [...CAMERA.position], rotation: [CAMERA.tilt, 0, 0] }}
      >
        <Scene count={labels.length} lit={lit} accent={accent} />
      </ThreeCanvas>
      {labels.map((text, i) => (
        <Label key={i} i={i} text={text} lit={i === lit} camera={camera} accent={accent} />
      ))}
    </AbsoluteFill>
  );
};
