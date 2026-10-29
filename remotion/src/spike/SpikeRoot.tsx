import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { VideoBackground } from "../components/VideoBackground";

const FPS = 30;
const DURATION = 5 * FPS;

type ImageProps = { imagePath: string };
type CompareProps = { imagePath: string; videoPath: string };

const Label: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      top: 48,
      left: 48,
      padding: "12px 24px",
      background: "rgba(0,0,0,0.6)",
      color: "white",
      fontSize: 44,
      fontFamily: "sans-serif",
      borderRadius: 12,
    }}
  >
    {text}
  </div>
);

const ImageOnly: React.FC<ImageProps> = ({ imagePath }) => (
  <KenBurnsImage assetPath={imagePath} durationInFrames={DURATION} />
);

// 왼쪽 AI 이미지(KenBurns) | 오른쪽 같은 쿼리의 007 Pexels b-roll
const Compare: React.FC<CompareProps> = ({ imagePath, videoPath }) => (
  <AbsoluteFill style={{ flexDirection: "row" }}>
    <div style={{ position: "relative", width: 1080, height: 1920 }}>
      <KenBurnsImage assetPath={imagePath} durationInFrames={DURATION} />
      <Label text="AI · FLUX.2 klein 4B" />
    </div>
    <div style={{ position: "relative", width: 1080, height: 1920 }}>
      <VideoBackground assetPath={videoPath} />
      <Label text="Pexels (007)" />
    </div>
  </AbsoluteFill>
);

export const SpikeRoot: React.FC = () => (
  <>
    <Composition
      id="SpikeA"
      component={ImageOnly}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={DURATION}
      defaultProps={{ imagePath: "A_image/klein_tone_s1_1080x1920.jpg" }}
    />
    <Composition
      id="SpikeACompare"
      component={Compare}
      fps={FPS}
      width={2160}
      height={1920}
      durationInFrames={DURATION}
      defaultProps={{ imagePath: "A_image/klein_tone_s1_1080x1920.jpg", videoPath: "A_image/ref/scene-1-title-broll.mp4" }}
    />
  </>
);
