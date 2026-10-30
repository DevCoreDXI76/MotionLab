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

## 2단계 진행 기록 (008 파이프라인 완주, 마감 12/31)
*실전 편 폴더(`projects/008_*`)가 생기면 M4부터 그쪽 log.md로 옮긴다.*
- 2026-10-30 M0 설계: 문서·코드 실측 후 `docs/2단계_설계.md` 작성 ~1세션. 기준선 vitest 71 / pytest 21 / tsc 0. 사람이 손대던 곳은 대본 작성·b-roll 쿼리/재검색·cast 명령 추가·단계 간 실행 판단 4곳으로 확인. 결정 대기 D1~D7.
- 2026-10-30 M1 스키마·프로바이더 ~1세션: script.json에 `visual.kind/query/prompt/clipId/source`와 `diagram` 씬 타입 추가(001~007 전부 그대로 통과), 대본 생성용 작성 스키마 분리, 프로바이더 4종(pexels 추출·aiImage(Cloudflare klein)·existingClip(flow_01)·motion) + 자동 폴백 체인, AI 비주얼 하한 판정 함수, `DiagramScene`(SpikeC 일반화) + 3D 포함 편만 `--gl=angle`, Pexels 키 `secrets/`로 이동(D4), flow_01 커밋(D7). 테스트 vitest 112 / pytest 21 / tsc 0.
  - 회귀: 007 앞 10초 새 코드 렌더 vs 변경 전 렌더 SSIM 1.000000, vs 공개본 0.9996. 003~007 metadata.txt 재생성 바이트 동일. 001~007 script.json 변경 0.
  - 실호출 스모크(임시 편 `_m1_smoke`, 확인 후 삭제): aiImage 2씬(klein 4장, ~1,250 neurons) + diagram + pexels + existingClip → TTS → render.ts 86초, 폴백 0, 하한 판정 충족. 후보 선택은 아직 "unjudged"(첫 후보) — M2에서 판정기로 교체.
  - **막힌 지점: Edge TTS가 HTTP 403** (msedge-tts 2.0.7, 재시도해도 동일 — Microsoft 쪽 핸드셰이크 변경으로 추정). msedge-tts 2.1.0(10/13 릴리스)으로 올려 해결, 버전 고정. 1기 렌더는 기존 mp3를 쓰므로 영향 없음.
  - Veo 워터마크는 실측상 하단 약 2.5% 안 → VideoBackground 수정 대신 ffmpeg에서 하단 5% 크롭(설계 문서 반영).
