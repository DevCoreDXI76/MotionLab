# 008_spike — log.md

## 소요시간 (세션 기준, 대략)
- 2026-10-29 셋업: 문서 확인 + 폴더·템플릿 생성 ~10분. 실험 A 도구 비교표 작성 후 사용자 선택 대기.
- 2026-10-29 방향 변경: fal 보류(사용액 0원) → Cloudflare Workers AI 무료 할당. 문서 확인 + generate.py provider 교체 + 10장 생성·검수 ~40분(생성 자체는 장당 2~10초).
- 2026-10-29 klein 보강: 8장 추가 생성·검수, Remotion SpikeA/SpikeACompare 렌더(74초/48초), verdict 확정 ~50분. 중간에 DNS 장애로 요청 1건이 10분 넘게 멈추고 2건 실패 → 재시도로 해결.
- 2026-10-29 실험 C: @remotion/three 설치·회귀 확인, SpikeC 작성, `--gl` 6옵션×웜 렌더 + 백엔드 확인 ~45분. 실험 B는 사용자가 Seedance 웹에서 직접 생성 대기 중(프롬프트 `spike/B_video/seedance_prompts.md`).
- 2026-10-30 실험 B: 사용자가 Google Flow(무료)에서 Veo 3.1 Lite 클립 2개 생성(클립당 약 5분) → 실측 검증·SpikeB/SpikeBCompare 렌더·Veo API 단가 확인·verdict 작성 ~40분.
- **2026-10-30 1단계(비주얼 스파이크) 종료.** 예정(11/12)보다 2주 일찍 완료. 판정 A 조건부·B 조건부·C 쓸 만함 → 사용자 결정 "0원 자동 구성"(klein+KenBurns 배경, 3D 다이어그램, Pexels 유지, Veo는 008 완주 후 선택). **1단계 총 사용액 0원**(fal 0원, Cloudflare 무료 할당, Google Flow 무료 크레딧). 2단계 착수는 별도 지시 대기.

## 막힌 지점
- 실험 B Seedance 경로 실패: Dreamina(Seedance) 가입 시 웰컴 무료 크레딧이 지급되지 않음 → 사용액 0원으로 포기하고 Google Flow(무료 계정, Veo 3.1 Lite, 50크레딧/일·클립당 10)로 전환. 같은 프롬프트(seedance_prompts.md) 사용.
- Gemini API의 Veo 3.1 Preview가 2026-10-22 종료됨 → API로 쓰려면 Google Cloud(Agent Platform/Vertex) GA Veo 또는 Gemini Omni Flash. 2단계 비용 검토 대상.
- ffmpeg drawtext는 이 PC에서 fontconfig 설정이 없어 segfault → 프레임 번호는 select 범위로 계산.
- `npx remotion gpu`는 헤드리스 셸에서 chrome://gpu 로드 실패(net::ERR_FAILED) → WebGL `UNMASKED_RENDERER_WEBGL` 문자열을 찍는 임시 컴포지션으로 백엔드 확인(확인 후 삭제).
- 4.0 기본(`--gl` 미지정)이 GPU가 아니라 SwiftShader로 폴백 — 화면은 정상이라 놓치기 쉬움. 3D는 `--gl=angle` 명시 필요.
- 로컬 DNS 일시 장애(getaddrinfo 11001): urllib의 timeout은 DNS 조회 단계에 적용되지 않아 10분 넘게 무응답. 재시도로 해결. 스크립트에 전체 실행 timeout을 걸어둘 것.
- 토큰 검증 401: account-owned 토큰(cfat_)은 `/user/tokens/verify`가 아니라 `/accounts/{id}/tokens/verify`로 검증해야 함. 실제 AI 호출에는 영향 없음.
- flux-1-schnell이 `seed`를 HTTP 400(5006)으로 거부: 공식 예시는 seed를 넘기지만 입력 스키마가 additionalProperties:false. → schnell은 시드 고정 불가(재현 불가). 400 거절은 neuron 0 소모. 원문은 spike/A_image/errors_seed_rejected.log.
- flux-2-klein-4b는 width 1080 요청 → 1072로 반환(16의 배수로 내림).

## 비용 누적 (fal.ai, 1달러 = 1,400원 환산) — 보류, 0원
- 실험 B: Google Flow 무료 크레딧 20/50 사용(2클립), 0원. Dreamina 0원.
| 일시 | 실험 | 내역 | 금액 | 누적 |
|---|---|---|---|---|

## Neuron 누적 (Cloudflare Workers AI 무료, 하루 10,000 / 80% 8,000에서 자동 중단)
| 일시(UTC) | 실험 | 내역 | 추정 neurons | 오늘 누적 |
|---|---|---|---|---|
| 2026-10-29 10:09:03 | A | klein_tone_s1 (flux-2-klein-4b, 1072x1920) | 312.6 | 312.6 |
| 2026-10-29 10:09:22 | A | repro_s1 (flux-1-schnell, 1024x1024) | 96.0 | 408.6 |
| 2026-10-29 10:09:30 | A | repro_s2 (flux-1-schnell, 1024x1024) | 96.0 | 504.6 |
| 2026-10-29 10:09:35 | A | repro_s4 (flux-1-schnell, 1024x1024) | 96.0 | 600.6 |
| 2026-10-29 10:09:39 | A | repro_s5 (flux-1-schnell, 1024x1024) | 96.0 | 696.6 |
| 2026-10-29 10:09:43 | A | tone_s1 (flux-1-schnell, 1024x1024) | 96.0 | 792.6 |
| 2026-10-29 10:09:45 | A | tone_s1_seedB (flux-1-schnell, 1024x1024) | 96.0 | 888.6 |
| 2026-10-29 10:09:48 | A | tone_s2 (flux-1-schnell, 1024x1024) | 96.0 | 984.6 |
| 2026-10-29 10:09:51 | A | tone_s4 (flux-1-schnell, 1024x1024) | 96.0 | 1080.6 |
| 2026-10-29 10:09:54 | A | tone_s5 (flux-1-schnell, 1024x1024) | 96.0 | 1176.6 |
| 2026-10-29 10:19:39 | A | klein_repro_s1 (flux-2-klein-4b, 1072x1920) | 312.6 | 1489.2 |
| 2026-10-29 10:19:45 | A | klein_repro_s2 (flux-2-klein-4b, 1072x1920) | 312.6 | 1801.8 |
| 2026-10-29 10:19:56 | A | klein_repro_s4 (flux-2-klein-4b, 1072x1920) | 312.6 | 2114.4 |
| 2026-10-29 10:20:03 | A | klein_repro_s5 (flux-2-klein-4b, 1072x1920) | 312.6 | 2427.0 |
| 2026-10-29 10:20~10:31 | A | klein_tone_s2 1차 요청 무응답 10분+ → 중단(과금 여부 불명, 보수적으로 1장분 계상) | 312.6 | (누적에 +312.6) |
| 2026-10-29 10:30:07 | A | klein_tone_s2 (flux-2-klein-4b, 1072x1920) | 312.6 | 2739.6 |
| 2026-10-29 10:30:15 | A | klein_tone_s4 (flux-2-klein-4b, 1072x1920) | 312.6 | 3052.2 |
| 2026-10-29 12:48:10 | A | klein_tone_s5 (flux-2-klein-4b, 1072x1920) | 312.6 | 3364.8 |
| 2026-10-29 12:48:18 | A | klein_tone_s1_seedB (flux-2-klein-4b, 1072x1920) | 312.6 | 3677.4 |

## 2단계 백로그
- **비주얼 출처를 script.json에 남기기**: 씬마다 b-roll 검색어 또는 생성 프롬프트와 선택한 클립 id(또는 seed·모델)를 `visual` 필드에 기록한다. 007은 쿼리가 script.json에 없고, gitignore된 `remotion/public/projects/007_resolution/videos/*.credit.json`에만 남아 있었다(로컬이 날아가면 함께 사라짐). `spike/A_image/manifest.json`이 이 구조의 시제품이다.
- **AI 이미지는 배경 전용, 읽혀야 하는 코드/터미널 텍스트는 Remotion 오버레이(cast-builder 연계)**: 실험 A에서 klein이 초점 맞은 가짜 글자를 22% 확률로 만들고, "screen out of focus" 지시로도 막지 못함. 화면 속 코드는 이미지에 맡기지 말고 Remotion 컴포넌트로 실제 텍스트를 위에 얹는다.
- **AI 영상은 연속 동작 컷 전용, 동작 전환은 KenBurns+편집으로 대체**: 실험 B에서 Veo 3.1 Lite가 시작 이미지의 동작을 잇는 컷(타이핑 지속)은 8초 내내 안정적이었지만, "멈춤→손 떼기" 같은 동작 전환 지시는 엉뚱한 손짓 후 원래 자세로 튀며 복귀했다. 전환이 필요한 장면은 정지 이미지 KenBurns 2컷을 편집으로 잇는다.
- **OAuth 앱 프로덕션 전환(008 이후)**: 테스트 모드 OAuth 앱은 refresh token이 7일 뒤 만료돼 매 편 재인증이 필요하다(M3에서 9/11 이후 만료 확인). Google Cloud 콘솔에서 앱 게시 상태를 프로덕션으로 바꿔 만료를 없앤다. 미검증 앱 경고 화면·범위(scope) 검증 요구 여부를 먼저 확인.

## 2단계 진행 기록 (008 파이프라인 완주, 마감 12/31)
*실전 편 폴더(`projects/008_*`)가 생기면 M4부터 그쪽 log.md로 옮긴다.*
- 2026-10-30 M0 설계: 문서·코드 실측 후 `docs/2단계_설계.md` 작성 ~1세션. 기준선 vitest 71 / pytest 21 / tsc 0. 사람이 손대던 곳은 대본 작성·b-roll 쿼리/재검색·cast 명령 추가·단계 간 실행 판단 4곳으로 확인. 결정 대기 D1~D7.
- 2026-10-30 M1 스키마·프로바이더 ~1세션: script.json에 `visual.kind/query/prompt/clipId/source`와 `diagram` 씬 타입 추가(001~007 전부 그대로 통과), 대본 생성용 작성 스키마 분리, 프로바이더 4종(pexels 추출·aiImage(Cloudflare klein)·existingClip(flow_01)·motion) + 자동 폴백 체인, AI 비주얼 하한 판정 함수, `DiagramScene`(SpikeC 일반화) + 3D 포함 편만 `--gl=angle`, Pexels 키 `secrets/`로 이동(D4), flow_01 커밋(D7). 테스트 vitest 112 / pytest 21 / tsc 0.
  - 회귀: 007 앞 10초 새 코드 렌더 vs 변경 전 렌더 SSIM 1.000000, vs 공개본 0.9996. 003~007 metadata.txt 재생성 바이트 동일. 001~007 script.json 변경 0.
  - 실호출 스모크(임시 편 `_m1_smoke`, 확인 후 삭제): aiImage 2씬(klein 4장, ~1,250 neurons) + diagram + pexels + existingClip → TTS → render.ts 86초, 폴백 0, 하한 판정 충족. 후보 선택은 아직 "unjudged"(첫 후보) — M2에서 판정기로 교체.
  - **막힌 지점: Edge TTS가 HTTP 403** (msedge-tts 2.0.7, 재시도해도 동일 — Microsoft 쪽 핸드셰이크 변경으로 추정). msedge-tts 2.1.0(10/13 릴리스)으로 올려 해결, 버전 고정. 1기 렌더는 기존 mp3를 쓰므로 영향 없음.
  - Veo 워터마크는 실측상 하단 약 2.5% 안 → VideoBackground 수정 대신 ffmpeg에서 하단 5% 크롭(설계 문서 반영).
  - 설계 §10 위험 1 해소: 새 작성 스키마로 `claude -p` 실호출 1회(구독 경로, 55초) → 스키마 검증 통과, `visual.kind/prompt`까지 채움, durationMs 미포함. 임시 결과는 삭제.
- 2026-10-30 M2 판정기·cast 이동 ~1세션:
  - **D2 실측 미달 → 전환**: Claude 비전 판정(`claude -p` + Read, 장당 22~41초)을 klein 9장 사람 검수와 비교 → 결함 통과 1(tone_s4 화면 글자), 오탈락 5/9(키캡 각인·겹친 손을 결함으로 판정). 합격선(0 / ≤2) 미달. 지시대로 픽셀 규칙(OpenCV 얼굴 검출 + 흰 테두리, 오류 시 탈락)으로 전환하고 aiImage를 정확히 2씬으로 제한. 픽셀 규칙은 같은 9장에서 오탈락 0, 결함 통과 3(손·글자는 못 봄). 결과표는 설계 문서 D2.
  - 얼굴 검출 기준 `minNeighbors=8`: 6에서는 얼굴 없는 klein 2장에 오검출. 004 Pexels b-roll(얼굴 있음)로 양성 대조 → 보이는 얼굴은 검출, 손으로 가린 얼굴은 놓침.
  - 후보 선택 연결: 첫 후보 사용 제거, 판정 근거(검사 항목·미검사 항목·사유)를 `visual.source.candidates`에 기록. 대본 프롬프트에 정적 포즈 한정·비주얼 배정·명령 형식 규칙 추가.
  - cast 명령: `props.commands` 우선, 002~007은 기존 SCENE_COMMANDS(HEAD와 바이트 동일). 허용 목록·secrets 경로 차단·출력/입력 비밀값 마스킹·30초 타임아웃·실패 명령 건너뛰기. 우회 시도 24종 테스트.
  - 실호출 스모크(임시 편, 확인 후 삭제): aiImage 1씬(klein 2장 ~625 neurons, 오늘 누적 ~1,876) → 픽셀 판정 통과·근거 기록. cast는 script.json 명령 2개 실행, `cat secrets/...` 시도는 정책에서 거부되어 실행 안 됨. 결과 파일 비밀값 0건.
  - 회귀: 007 앞 10초 SSIM 1.000000, 003~007 metadata 동일, vitest 162 / pytest 21 / tsc 0.
- 2026-10-30 M3 오케스트레이터 ~1세션:
  - `produce.ts <id> [--dry-run]`: preflight(TTS 1문장 실호출·YouTube 토큰 포함) → 대본(concept.md 입력, 스키마·의도 검증 실패 시 오류를 붙여 재생성, 상한 초과는 코드에서 강등) → cast → TTS(재시도) → 비주얼(폴백) → 렌더(실패 시 재시도→3D 강등) → 비공개 업로드. 실행마다 log.md "자동 실행 기록"에 단계표·자동 폴백·사람 개입·AI 비주얼 하한 판정을 남김. 재실행·자동 해결 실패·재생목록 추가 실패는 개입으로 자동 기록.
  - D6: `visual.source` 있는 편만 설명에 AI 생성 고지·Pexels 크레딧, AI 이미지/영상이 있으면 `containsSyntheticMedia=true`(API 문서로 필드 확인). 003~007 metadata는 바이트 동일.
  - D8 사전 측정: 새 구도 규칙으로 klein 6장(`spike/A_image/d8_check/`), 픽셀 판정 5 통과·d8_6 얼굴 검출(오검출 의심). 사용자 검수 대기.
  - **dry-run(임시 편 `_m3_dryrun`, concept = M2 판정기 이야기, 확인 후 삭제)**: 사람 개입 0건, 자동 폴백 0건, AI 비주얼 하한 충족(aiImage 2/2, diagram 1/1), 약 3분 40초(대본 55초·비주얼 46초·렌더 114초), neurons ~1,250. 대본 사실·수치는 concept와 일치. 영상 72.6초(목표 45~60초 초과).
  - **막힌 지점**: (1) YouTube refresh token `invalid_grant` — 9/11 이후 만료, M4 전 재인증 필요. (2) dry-run의 AI 이미지 하나가 "인화 사진 9장" 소품 → 사진 속 작은 얼굴은 검사 밖 → 프롬프트에 사진·포스터·액자 금지 추가. (3) 셸 cwd가 지울 폴더 안이라 정리 1회 실패 → 루트에서 재실행.
  - Cloudflare 오늘 누적 추정 ~5,000 / 8,000.
  - 회귀: 007 앞 10초 SSIM 1.000000, 003~007 metadata 동일, vitest 176 / pytest 26 / tsc 0.
- 2026-10-30 M3 확인 후 ~1세션:
  - D8 사전 측정 사용자 검수: 결함 2/6(d8_3 공책·d8_5 포스트잇의 가짜 손글씨). 화면 속 가짜 글자는 0/6, 글자가 종이 소품으로 옮겨 감. d8_6 얼굴 검출은 오검출 확정.
  - 조치: 종이 소품 금지(공책·포스트잇·메모지·종이·책·문서·영수증)를 `visual_style.json` 접미사와 대본 프롬프트에 추가. 같은 6개 프롬프트·같은 시드로 `spike/A_image/d8_check2/` 재생성(~1,876 neurons, 오늘 누적 ~6,877 / 8,000) → 픽셀 판정 6/6 통과. 사용자 검수 대기.
  - 얼굴 오검출 1/12(≈8.3%) → aiImage 하한이 오검출만으로 깨질 확률 점추정 ~0.01%, 보수 추정 ~4.2%(설계 문서 D8).
  - YouTube 재인증: M4 실행 직전 사용자가 직접(개입 아님). preflight에서 막힌 뒤 재인증은 개입. OAuth 프로덕션 전환은 백로그.
  - **실전 편 `projects/008_ai_visual/` 생성, concept.md 커밋(개입 ① 소재 선정, 2026-10-30 15:17 KST).** 이후 실전 기록은 그쪽 log.md에 남긴다.
  - D8 재측정 사용자 검수: 결함 2/6(d8_3 공책 더 크게·d8_5 포스트잇이 키캡 위). 결함은 모두 장면 프롬프트가 종이를 직접 요구한 경우, 요구하지 않은 4개 프롬프트는 1·2차 8장 모두 정상 → 접미사 "no ~"는 명시 요구를 못 이긴다.
  - 조치: `validateVisualIntent`에 종이·글씨 소품 단어 가드(notebook·sticky·paper·book·note·photo 등 16개, 단어 단위·복수형) → 걸리면 오류를 붙여 대본 재생성. keyboard·laptop·MacBook·wallpaper 오탐 없음 테스트.
  - preflight 할당 점검 확인: 이미 실전 최대치(aiImage 2씬 × 2라운드 × 2장 = 8회 ≈ 2,501 neurons) 기준이었음. 값을 생성기 상수에서 가져오도록 바꿔 어긋날 여지를 없앰. 오늘 누적 ~6,877이라 M4는 10/31 09:00 KST 리셋 후.
  - `data/cloudflare_neurons.jsonl` 커밋(비밀값 없음, 사용자 확인). vitest 180 / pytest 26 / tsc 0.
