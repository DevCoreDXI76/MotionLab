# 007_resolution — log.md

## 소요시간 (세션 기준, 대략)
- 기획(concept.md) + 대본(script.json) 직접 작성: ~15분 — 소재는 같은 세션에서 실제로 고친
  버그(pickBestFile 해상도 필터, 커밋 `50a28f0`)를 그대로 대본화, 새 사건 발굴 없음
- TTS(EdgeTtsProvider) + duration 주입: 1회 실행, 즉시
- `generate-terminal-cast.ts`에 007용 SCENE_COMMANDS 항목 추가(`npx vitest run scripts/lib/pexels.test.ts`) + 1회 실행, 즉시
- Pexels b-roll ×4: scene-1/2/5는 1차 검색에서 바로 720×1280 이상 통과(스스로 고친 해상도
  필터가 실제로 작동하는 걸 이 세션에서 바로 확인). scene-4는 1차 쿼리에서 Pexels API가 500
  에러를 반환해 쿼리를 두 번 바꿔 재시도 — 두 재시도 모두 동일 클립(Mizuno K, id 12893579)이
  결과로 나와 scene-2와 b-roll이 중복됨(화면 내용은 정책 위반 아님, 다양성만 아쉬움)
- 렌더: 1회, 문제 없이 통과(54.4초)

## 막힌 지점
- **Pexels API 500 에러**(scene-4-fix 1차 쿼리 "hands typing code fix on laptop close up"):
  003~006에서 겪은 "저해상도라 재검색"과는 다른 새로운 실패 모드 — 요청 자체가 서버 에러로
  실패함. 쿼리 문구를 바꿔 재시도하니 해결됐지만 근본 원인(왜 특정 쿼리 문구에서 500이 나는지)은
  확인하지 않았음. 재발하면 원인 조사 필요.
- **b-roll 다양성**: 재검색해도 같은 인기 클립이 반복 노출될 수 있음을 처음 확인(scene-2와
  scene-4가 동일 소스) — 해상도 정책·인물 정책과 별개로, "다양성"까지는 `pickBestFile()`이
  보장하지 않는다는 한계가 새로 드러남.
- 그 외엔 006까지와 달리 **저해상도 재검색 자체가 한 번도 필요 없었음** — 이번 세션에서 고친
  필터가 바로 이 세션의 제작에서 검증된 셈.

## 완성 기준(콘텐츠 3~5편) 진행 상황
002_test(미카운트) → 003_pipeline(1편) → 004_failures(2편) → 005_casting(3편, 게이트 달성) →
006_recap(4편) → **007_resolution(5편) — 5편 게이트 달성**.
