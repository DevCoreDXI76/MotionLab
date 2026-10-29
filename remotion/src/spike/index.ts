import { registerRoot } from "remotion";
import { SpikeRoot } from "./SpikeRoot";

// 008 비주얼 스파이크 전용 엔트리 — 기존 Root(Episode)와 분리. --public-dir=../projects/008_spike/spike 로 렌더.
registerRoot(SpikeRoot);
