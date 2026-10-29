# 008_spike — log.md

## 소요시간 (세션 기준, 대략)
- 2026-10-29 셋업: 문서 확인 + 폴더·템플릿 생성 ~10분. 실험 A 도구 비교표 작성 후 사용자 선택 대기.
- 2026-10-29 방향 변경: fal 보류(사용액 0원) → Cloudflare Workers AI 무료 할당. 문서 확인 + generate.py provider 교체 + 10장 생성·검수 ~40분(생성 자체는 장당 2~10초).
- 2026-10-29 klein 보강: 8장 추가 생성·검수, Remotion SpikeA/SpikeACompare 렌더(74초/48초), verdict 확정 ~50분. 중간에 DNS 장애로 요청 1건이 10분 넘게 멈추고 2건 실패 → 재시도로 해결.

## 막힌 지점
- 로컬 DNS 일시 장애(getaddrinfo 11001): urllib의 timeout은 DNS 조회 단계에 적용되지 않아 10분 넘게 무응답. 재시도로 해결. 스크립트에 전체 실행 timeout을 걸어둘 것.
- 토큰 검증 401: account-owned 토큰(cfat_)은 `/user/tokens/verify`가 아니라 `/accounts/{id}/tokens/verify`로 검증해야 함. 실제 AI 호출에는 영향 없음.
- flux-1-schnell이 `seed`를 HTTP 400(5006)으로 거부: 공식 예시는 seed를 넘기지만 입력 스키마가 additionalProperties:false. → schnell은 시드 고정 불가(재현 불가). 400 거절은 neuron 0 소모. 원문은 spike/A_image/errors_seed_rejected.log.
- flux-2-klein-4b는 width 1080 요청 → 1072로 반환(16의 배수로 내림).

## 비용 누적 (fal.ai, 1달러 = 1,400원 환산) — 보류, 0원
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
