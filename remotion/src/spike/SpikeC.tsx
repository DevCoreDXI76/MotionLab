import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { PerspectiveCamera, Vector3 } from "three";

// 실험 C — 파이프라인 7단계 블록이 하나씩 쌓이고 카메라가 천천히 공전.
// 블록 위 글자는 3D 텍스트가 아니라 같은 카메라로 투영한 좌표에 얹는 2D 오버레이(실험 A 결론과 같은 원칙).

const WIDTH = 1080;
const HEIGHT = 1920;
const STAGES = ["기획", "대본", "나레이션", "B-roll", "터미널 캐스트", "렌더", "업로드"];
const BLOCK = { w: 3.2, h: 0.5, d: 1.6, gap: 0.1 };
const DROP_START = 6;
const DROP_EVERY = 14;
const DROP_HEIGHT = 3;

const CAMERA = { fov: 38, position: [0, 4.6, 13] as const, tilt: -Math.atan2(4.6 - 2.1, 13) };

const restY = (i: number) => BLOCK.h / 2 + i * (BLOCK.h + BLOCK.gap);

// 0 → 1 as block i lands; shared by the 3D mesh and its 2D label so they move together.
const useLanding = (i: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - (DROP_START + i * DROP_EVERY), fps, config: { damping: 14, mass: 0.6 } });
};

const Block: React.FC<{ i: number; isLatest: boolean }> = ({ i, isLatest }) => {
  const p = useLanding(i);
  if (p <= 0.001) return null;
  return (
    <mesh position={[0, restY(i) + (1 - p) * DROP_HEIGHT, 0]}>
      <boxGeometry args={[BLOCK.w, BLOCK.h, BLOCK.d]} />
      <meshStandardMaterial
        color="#16233a"
        metalness={0.35}
        roughness={0.35}
        emissive="#2f7bff"
        emissiveIntensity={isLatest ? 0.35 : 0.08}
        transparent
        opacity={Math.min(1, p * 1.5)}
      />
    </mesh>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Orbit = rotate the whole world (blocks + lights) the other way; identical on screen to moving the camera.
  const orbit = interpolate(frame, [0, durationInFrames], [0.55, -0.55]);
  const latest = Math.min(STAGES.length - 1, Math.floor((frame - DROP_START) / DROP_EVERY));
  return (
    <group rotation={[0, orbit, 0]}>
      <ambientLight intensity={0.25} color="#8fb4ff" />
      <directionalLight position={[4, 8, 6]} intensity={1.6} color="#9cc3ff" />
      <pointLight position={[-3, 2, 4]} intensity={18} color="#3d8bff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[5, 48]} />
        <meshStandardMaterial color="#0b1220" roughness={0.9} />
      </mesh>
      {STAGES.map((_, i) => (
        <Block key={i} i={i} isLatest={i === latest} />
      ))}
    </group>
  );
};

const Label: React.FC<{ i: number; camera: PerspectiveCamera }> = ({ i, camera }) => {
  const p = useLanding(i);
  if (p <= 0.001) return null;
  // Block centres sit on the orbit axis, so their projection does not depend on the orbit angle.
  const v = new Vector3(0, restY(i) + (1 - p) * DROP_HEIGHT, BLOCK.d / 2).project(camera);
  return (
    <div
      style={{
        position: "absolute",
        left: ((v.x + 1) / 2) * WIDTH,
        top: ((1 - v.y) / 2) * HEIGHT,
        transform: "translate(-50%, -50%)",
        opacity: Math.min(1, p * 1.5),
        color: "#e6f0ff",
        fontFamily: "sans-serif",
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: 1,
        whiteSpace: "nowrap",
        textShadow: "0 0 18px rgba(61,139,255,0.8)",
      }}
    >
      {`${i + 1}. ${STAGES[i]}`}
    </div>
  );
};

export const SpikeC: React.FC = () => {
  const camera = useMemo(() => {
    const c = new PerspectiveCamera(CAMERA.fov, WIDTH / HEIGHT, 0.1, 100);
    c.position.set(...CAMERA.position);
    c.rotation.set(CAMERA.tilt, 0, 0);
    c.updateMatrixWorld();
    c.updateProjectionMatrix();
    return c;
  }, []);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #0f1b33 0%, #05080f 70%)" }}>
      <ThreeCanvas
        width={WIDTH}
        height={HEIGHT}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 100, position: [...CAMERA.position], rotation: [CAMERA.tilt, 0, 0] }}
      >
        <Scene />
      </ThreeCanvas>
      {STAGES.map((_, i) => (
        <Label key={i} i={i} camera={camera} />
      ))}
    </AbsoluteFill>
  );
};
