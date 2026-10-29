# 실험 B — image-to-video 프롬프트 이력 (2026-10-29 작성)

> **실제 사용 (2026-10-30):** Dreamina(Seedance)는 무료 크레딧이 지급되지 않아 쓰지 못했고, 아래 초안 1·2를 **Google Flow(Veo 3.1 Lite)에 그대로** 넣어 `flow_01.mp4`, `flow_02.mp4`를 생성했다. 결과는 `../../spike_verdict.md` 실험 B 참조.

## 입력 이미지 추천: `../A_image/klein_tone_s1_1080x1920.jpg`

- 실험 A klein 9장 중 베스트. 얼굴 없음, 손 왜곡 없음, 화면 아웃포커스라 가짜 글자가 거의 읽히지 않음
- 타이핑은 klein이 가장 안정적으로 그린 동작 → 영상 모델이 이어서 움직이기에 무리가 없음
- 같은 장면의 Pexels ref(`../A_image/ref/scene-1-title-broll.mp4`)가 있어서 SpikeACompare와 같은 방식으로 3자 비교 가능(정지+KenBurns / AI 영상 / Pexels)
- 차선: `klein_tone_s1_seedB_1080x1920.jpg`(거의 같은 구도). 1번이 실패하면 이것으로 재시도

## 공통 설정

- 비율 9:16, 길이 5초(무료 크레딧 범위에서 가장 짧게), 해상도는 무료로 고를 수 있는 최댓값
- 생성 결과는 `B_video/seedance_01.mp4`, `seedance_02.mp4`로 저장 → 검수 항목은 실험 A와 동일(손가락·자판 왜곡, 얼굴, 글자, 동작 준수)

## 프롬프트 초안 1 — 타이핑 지속 + 느린 푸시인 (scene-1 타이틀 배경용)

```
The hands keep typing naturally on the laptop keyboard in a steady, relaxed rhythm.
Slow, smooth camera push-in toward the hands. The laptop screen stays softly out of focus.
Dark room at night, the only light is the cool glow of the screen, which flickers very slightly.
Realistic 35mm film look, subtle grain. Hands only, no face, no new objects, no text appearing.
```

- 노리는 것: 가장 쉬운 동작(타이핑 지속)과 카메라 이동만 시켜서 "손가락이 움직일 때 몇 개로 보이는지, 자판이 녹지 않는지"를 확인

## 프롬프트 초안 2 — 멈춤 → 손 떼기 (scene-5 "해결 후 여운"용)

```
The hands type a few more keys, then stop, and slowly lift off the keyboard and rest at the edge of the laptop.
The camera is static, locked off. Shallow depth of field, focus on the hands, screen blurred.
Dark room at night lit only by cool monitor glow. Realistic 35mm film look.
Hands only, no face, no text appearing, no morphing.
```

- 노리는 것: 실험 A에서 이미지 모델이 실패한 "타이핑 이외의 동작"(덮기·스크롤)을 영상 모델이 따를 수 있는지. 카메라를 고정해 손 동작 하나만 평가
- 실패하면(손가락 녹음·추가 손 등) "동작 연출은 B로도 안 됨 → KenBurns + 오버레이"가 결론이 됨
