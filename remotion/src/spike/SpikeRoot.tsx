import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { KenBurnsImage } from "../components/KenBurnsImage";
import { VideoBackground } from "../components/VideoBackground";
import { SpikeC } from "./SpikeC";

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

// Veo 720×1280 클립을 1080×1920으로 확대(cover), 음소거 — VideoBackground가 둘 다 처리.
const VideoOnly: React.FC<{ videoPath: string }> = ({ videoPath }) => <VideoBackground assetPath={videoPath} />;

// 왼쪽 AI 이미지(KenBurns) | 가운데 같은 이미지에서 시작한 AI 영상 | 오른쪽 007 Pexels b-roll
const Compare3: React.FC<{ imagePath: string; aiVideoPath: string; refPath: string }> = ({
  imagePath,
  aiVideoPath,
  refPath,
}) => (
  <AbsoluteFill style={{ flexDirection: "row" }}>
    <div style={{ position: "relative", width: 1080, height: 1920 }}>
      <KenBurnsImage assetPath={imagePath} durationInFrames={DURATION} />
      <Label text="A · klein KenBurns" />
    </div>
    <div style={{ position: "relative", width: 1080, height: 1920 }}>
      <VideoBackground assetPath={aiVideoPath} />
      <Label text="B · Veo 3.1 Lite (720p→1080p)" />
    </div>
    <div style={{ position: "relative", width: 1080, height: 1920 }}>
      <VideoBackground assetPath={refPath} />
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
    <Composition
      id="SpikeB"
      component={VideoOnly}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={DURATION}
      defaultProps={{ videoPath: "B_video/flow_01.mp4" }}
    />
    <Composition
      id="SpikeBCompare"
      component={Compare3}
      fps={FPS}
      width={3240}
      height={1920}
      durationInFrames={DURATION}
      defaultProps={{
        imagePath: "A_image/klein_tone_s1_1080x1920.jpg",
        aiVideoPath: "B_video/flow_01.mp4",
        refPath: "A_image/ref/scene-1-title-broll.mp4",
      }}
    />
    <Composition id="SpikeC" component={SpikeC} fps={FPS} width={1080} height={1920} durationInFrames={DURATION} />
  </>
);
