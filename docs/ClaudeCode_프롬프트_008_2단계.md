# Claude Code 착수 프롬프트 — 모션랩 2기 2단계 (008 파이프라인 완주)

*사용법: `C:\MyProjects\02_Agent\MotionLab`에서 Claude Code를 열고 아래 코드 블록 전체를 첫 메시지로 붙여넣기. 1차 산출물은 설계 문서이고, 승인 후 마일스톤별로 진행한다.*

```
모션랩 2기 2단계 "008 파이프라인 완주"를 시작한다. 1단계(비주얼 스파이크)는 10/30 완료, 비주얼 방식은 "0원 자동 구성"으로 확정됐다. 마감은 12/31이다.

## 0. 먼저 읽을 것
- docs/프로젝트_재정의_2026-10-29.md — 완성 기준(최우선)
- projects/008_spike/spike_verdict.md — 맨 위 결론 칸과 A·B·C의 "③단계에 넣는다면 필요한 것"
- projects/008_spike/log.md — "2단계 백로그"
- docs/remotion_트레이드오프_claudecode인계.md — 항목 12(대본 자동화), 14(발음 사전), 15(화면 캡처 금지)
- 현재 파이프라인 코드: remotion/scripts/(generate-script, generate-narration, generate-broll, generate-terminal-cast, render, lib/), remotion/src/(sceneRegistry, components/scenes), templates/, scripts/youtube_upload.py
- projects/007_resolution/ — 1기 마지막 편의 concept.md / script.json / log.md (현재 수준의 기준점)

## 1. 완성 기준 (이 문장을 그대로 충족해야 "완료")
008편이 concept.md 입력 → 대본 → TTS → 비주얼 → 렌더 → 썸네일·메타데이터 → 비공개 업로드까지 **사람 개입 없이** 통과하고, 사람은 ① concept.md 작성과 ⑦ 최종 검수(업로드된 비공개 영상 확인 후 공개 전환 승인) 두 곳에서만 개입한다. log.md에 개입 지점이 2곳 이하로 기록된다.
- "Claude Code 세션에서 내가 명령 하나를 실행시키는 것"은 개입으로 세지 않는다. 중간에 내가 파일을 고르거나, 고치거나, 재실행을 판단하는 것은 개입이다.

## 2. 확정된 비주얼 방식 (재논의하지 않음)
- 배경: flux-2-klein-4b(Cloudflare Workers AI 무료) + KenBurns. 읽혀야 하는 텍스트는 Remotion 오버레이로만 처리한다.
- 구조/다이어그램: @remotion/three 3D 씬, 렌더 시 --gl=angle.
- 실제 움직임이 필요한 컷: 기존 Pexels 자동 검색 유지(해상도·얼굴·중복 필터 그대로).
- 이미 있는 클립 재사용 허용: projects/008_spike/spike/B_video/flow_01.mp4를 "실험 결과 화면"으로 쓸 수 있다(새 생성 아님, 음소거, 1080×1920 확대).
- AI 영상 신규 생성(Veo 등 유료 API)은 하지 않는다.

## 3. 절대 규칙
1. 화면/데스크톱/창 자동 캡처 금지(항목 15).
2. 유료 API 호출 금지. Cloudflare는 무료 할당 80% 상한, 유료 전환 금지. 대본 생성은 기존 ClaudeCliRunner 경로를 쓰고, 별도 API 키 과금 경로를 새로 만들지 않는다.
3. 키·토큰은 secrets/에서만 읽고 출력·로그·커밋에 노출하지 않는다.
4. 비주얼 정책: 얼굴 금지, 손·화면·사물 위주. AI 이미지에도 동일.
5. YouTube는 비공개(private) 업로드까지만. 공개 전환은 내가 채팅에서 명시적으로 승인한 뒤에만 한다.
6. 001~007 편의 산출물과 결과가 바뀌면 안 된다. 기존 테스트는 계속 통과해야 한다.
7. .claude/settings.json 변경과 _tmp_review/는 커밋하지 않는다.

## 4. 2단계 백로그 (spike·log에서 누적된 것)
1. 씬별 비주얼 출처(검색어/생성 프롬프트·시드·모델·클립 id)를 script.json에 기록
2. AI 이미지는 배경 전용, 텍스트는 Remotion 오버레이
3. 장면당 후보 이미지 선택 자동화 — 1단계에서 사람이 보던 검수 기준(손 왜곡·얼굴·초점 맞은 가짜 글자·흰 테두리)을 규칙화. Claude 비전 판정(ClaudeCliRunner로 이미지 파일 읽기)이 가능한지 먼저 확인하고, 안 되면 대안을 제시
4. AI 영상은 연속 동작 컷 전용, 동작 전환은 KenBurns+편집으로 대체 (008에서는 기존 flow_01 재사용만)
5. 3D 씬 props 일반화(단계명·색 등을 script.json에서), --gl=angle 적용 범위 결정(2D 렌더 영향 확인)
6. 터미널 cast 명령을 SCENE_COMMANDS 상수가 아니라 script.json의 code 씬 필드에서 읽기
7. 단일 진입점: concept.md 하나로 위 단계를 순서대로 실행하는 오케스트레이터(실패 시 재시도·폴백 규칙 포함, 사람 개입이 필요한 지점이 생기면 그 사실을 log.md에 자동 기록)

## 5. 진행 방식 — 마일스톤별로 멈춘다
M0. 설계 (이번 턴): 코드를 실제로 읽고 docs/2단계_설계.md 작성 후 멈춰라.
  - 현재 파이프라인 단계별로 "이미 자동 / 반자동 / 수동" 실측 표(근거: 코드 위치, 007 log.md)
  - 백로그 1~7 각각의 구현안, 바뀌는 파일, 기존 편 회귀 위험, 예상 소요
  - script.json 스키마 변경안(visual.kind: pexels | aiImage | three | existingClip 등, 출처 필드)과 대본 프롬프트 템플릿 변경안
  - 실패/폴백 규칙: 예) klein 후보 N장 모두 탈락 → Pexels 폴백, Cloudflare 할당 초과 → 다음 날 재시도 대신 Pexels 폴백 등
  - 결정이 필요한 항목은 2~3개 방안 + 추천안으로 정리(최종 결정은 내가 한다)
  - 마일스톤 일정(M1~M4)과 12/31까지의 버퍼
M1. 스키마·씬 타입·비주얼 프로바이더(aiImage, three, existingClip) 구현 + 테스트 + 기존 편 회귀 확인
M2. 후보 자동 선택(백로그 3) + cast 명령 이동(백로그 6)
M3. 오케스트레이터(백로그 7) + dry-run(업로드 제외 전 구간)
M4. projects/008_*/concept.md(내가 작성) 입력으로 실전 1회 → 비공개 업로드 → log.md에 개입 지점 기록 → 보고 후 멈춤

각 마일스톤 끝에: 커밋(마일스톤 단위), log.md 갱신, 아래 형식으로 보고하고 멈춰라.
- 한 일 / 바뀐 파일 / 테스트 결과 / 회귀 확인 / 남은 위험 / 내가 결정할 것
- 노션 작업 로그 초안(기존 형식)

## 시작
M0만 진행하라. 0번 문서와 코드를 읽고 docs/2단계_설계.md를 작성한 뒤 보고하고 멈춰라.
```
