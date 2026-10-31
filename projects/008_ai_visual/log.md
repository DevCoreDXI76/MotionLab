# 008_ai_visual — log.md

## 사람 개입 기록 (완성 기준: ①·⑦ 외 개입 없음, 2곳 이하)
- **개입 ① 소재 선정 — 2026-10-30 15:17 KST**: 사용자가 concept.md를 채팅으로 승인, 내용 그대로 작성·커밋. (허용된 개입 ①)

## 자동 실행 기록 (produce.ts)

*오케스트레이터가 실행마다 자동으로 남긴다. 사람 개입 집계는 M4 실전 실행 기준.*

### 2026-10-31 02:21 UTC — 실행: **비공개 업로드 완료 — ⑦ 최종 검수 대기 (완성 판정은 ⑦ 승인 후)**

| 단계 | 결과 | 시도 | 소요 | 메모 |
|---|---|---|---|---|
| preflight | ✅ ok | 1 | 5초 | 10개 점검 통과 |
| script | ✅ ok | 1 | 63초 | 씬 5개: aiImage, aiImage, existingClip, diagram, pexels |
| cast | ✅ ok | 1 | 0초 |  |
| narration | ✅ ok | 1 | 2초 |  |
| visuals | ✅ ok | 1 | 49초 | 폴백 0건 |
| render | ✅ ok | 1 | 192초 |  |
| upload | ✅ ok | 1 | 27초 | privacy=private |

- **사람 개입(이 실행 중)**: 0건 — ①(concept.md 작성)과 ⑦(최종 검수) 외 없음
- 자동 폴백·재시도: 0건 (사람 개입 아님)
- AI 비주얼 하한: 충족 (aiImage 2/2, diagram 1/1)
- Cloudflare neurons(추정): 1250.4
- 업로드(비공개): https://youtu.be/LuiqsjNnvSM
