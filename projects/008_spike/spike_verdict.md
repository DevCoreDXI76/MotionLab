# 008_spike — spike_verdict.md

*1단계 비주얼 스파이크(2026-10-29 ~ 11-12) 판정. 기준: docs/프로젝트_재정의_2026-10-29.md*

## 2단계에 가져갈 비주얼 방식 (결론)

(세 실험 판정 후 작성 — 추천안 포함, 최종 결정은 사용자)

---

## 실험 A — AI 실사 이미지

- 판정: **조건부 채택 — flux-2-klein-4b 한정(배경 전용)**. flux-1-schnell은 **탈락**
- 근거(한 줄): klein 9장 중 손 왜곡은 1장(11%), 얼굴 노출 0장으로 Pexels급 실사. 다만 초점 맞은 가짜 글자가 2장(22%), 동작 지시 불이행이 2장(+애매 1장) → 텍스트를 읽혀야 하는 장면이나 특정 동작 연출에는 쓸 수 없음
- 도구·모델: Cloudflare Workers AI 무료 할당(하루 10,000 neurons, Free 플랜은 초과 시 과금 없이 에러). `@cf/black-forest-labs/flux-2-klein-4b`(9장, steps 고정 4, 1072×1920) / 비교군 `@cf/black-forest-labs/flux-1-schnell`(9장, steps 8)
- 해상도 / 1080×1920 (공식 문서 기준, 2026-10-29):
  - klein-4b: width·height 각 256~1920 → **세로 직접 생성 가능**. 16 배수만 받아서 1080은 1072로 내림 → 1072×1920 생성 후 1.007배 보정(사실상 네이티브)
  - schnell: 입력 스키마가 prompt·steps뿐이라 width/height 지정 불가 → **1024×1024 고정**. 9:16 크롭 시 576×1024 → 1.875배 확대 필요
  - flux-2-dev: 출력 타일당·스텝당 37.5 neurons → 1080×1920 한 장에 수천 neurons 추정. 하루 1~2장 수준이라 미호출
- 장당 비용: 0원. neurons 추정 klein ~313 / schnell 96(타일 올림 계산이라 보수적). 오늘 누적 ~3,677(멈춘 요청 1건을 보수적으로 더하면 ~3,990, 39.9%). 하루 무료로 klein만 쓰면 약 25장(80% 상한 기준). 할당 리셋은 00:00 UTC(한국 09:00)
- 생성 시간: klein 6.6~10.3초(9장 평균 ~7.8초), schnell 2~5초
- 실패율(klein 9장): API 생성 실패 0/9(DNS 장애로 인한 재시도 2건은 로컬 네트워크 문제라 제외). 품질 탈락 1/9(tone_s5)
- 손가락 왜곡률(klein): **1/9 = 11%**(tone_s5: 손이 반투명하게 이중으로 겹침). 손가락 개수·관절 붕괴는 0건
- 얼굴 노출(klein): **0/9**
- 글자 왜곡(klein): 자판 각인·화면 코드는 9장 모두 가짜 글자. **초점이 맞아 가짜인 게 읽히는 장면 2/9 = 22%**(repro_s2 전경 기기/자판, tone_s4 화면). "screen out of focus, shallow depth of field"를 붙인 5장 중에서도 2장은 지시를 무시 → 프롬프트만으로는 막을 수 없음
- 동작 지시 준수(klein): **6/9 준수, 1/9 애매(repro_s5 화면 모서리를 잡음), 2/9 불이행**(repro_s2 스크롤→타이핑, tone_s5 덮기→타이핑). "타이핑" 이외의 동작은 3개 중 1개 정도만 성공
- 시드 고정 시 톤 일관성(klein): tone_s1을 seed 20261029 / 777로 비교 → 구도(노트북 왼쪽·손 오른쪽 측면)와 야간 저조도 톤이 **거의 동일**. 시드보다 프롬프트가 톤을 지배함. tone_* 5장 모두 같은 야간 톤 유지(5/5). 단 "cool blue monitor glow"는 약하게 반영돼 중성 쿨톤으로 나옴
  - 정정: 1차 보고의 schnell `tone_s1_seedB`는 시드 비교가 아님(schnell은 seed 파라미터를 400으로 거부 → 같은 프롬프트의 무작위 재샘플일 뿐)
- schnell 탈락 사유: 1:1 고정(1.875배 확대), seed 불가(재현 불가), 9장 중 2장 결함(repro_s4 손 포즈 기형, tone_s1 흰 테두리 프레임), 채도 높은 "AI 스톡" 느낌
- Remotion 렌더(Intel Core Ultra 7 258V, 번들링 포함 wall-clock): `SpikeA`(klein_tone_s1 5초 KenBurns, 1080×1920) **74초** / `SpikeACompare`(같은 장면 vs 007 Pexels scene-1, 2160×1920) **48초**. 74초는 spike 엔트리의 첫 콜드 번들 포함값. 실험 C에서 같은 번들로 다시 잰 웜 렌더는 SpikeA **19초** → 2D 기준치는 웜 19초를 사용
- ③단계에 넣는다면 필요한 것: (1) klein-4b, 1072×1920 → 1080×1920 보정. (2) **배경 전용** — 읽혀야 하는 코드/터미널 텍스트는 Remotion 오버레이로 처리(cast-builder 연계, log.md 백로그). (3) 동작은 "타이핑·손 올려두기" 같은 정적 포즈로 한정하고, 필요한 동작은 KenBurns나 실험 B 영상으로 처리. (4) 장면당 2장 생성 후 사람이 1장 고르기(탈락률 ~1/3 감안). 하루 25장이면 에피소드 2~3편분
- Pexels 대비 소감: 같은 장면 좌우 비교에서 klein이 톤 통제(야간·저조도)는 더 낫고, 실사감은 대등. Pexels는 실제 움직임이 있고 klein은 정지 이미지에 KenBurns만 들어감 → 장면 길이 5초 이상이면 단조로움
- 샘플 경로: `spike/A_image/klein_*_1080x1920.jpg`(원본 `raw/`, gitignore), 렌더 `spike/A_image/render/SpikeA.mp4`, `SpikeACompare.mp4`(gitignore), 검수 상세는 `manifest.json`의 review

## 실험 B — AI 영상 클립

- 판정: (쓸 만함 / 조건부 / 아직 아님)
- 근거(한 줄):
- 도구·모델:
- 클립당 비용:
- 생성 시간:
- 실패율:
- 손가락·키보드 자판 왜곡:
- 얼굴 노출 여부:
- ③단계에 넣는다면 필요한 것:
- 샘플 경로:

## 실험 C — Remotion 3D 씬

- 판정: **쓸 만함** (단 `--gl=angle` 필수)
- 근거(한 줄): 7블록 적층+카메라 공전 5초 씬이 GPU(angle)로 웜 16초 → 2D KenBurns(19초)와 같거나 더 빠르고, 2D 라벨 오버레이도 3D 블록에 정확히 붙음. 실패 0/8
- 도구·모델: @remotion/three 4.0.512(remotion과 같은 버전 고정) + three 0.186.1 + @react-three/fiber 9.8.2 + @types/three 0.186.0. 설치 후 `tsc --noEmit` 통과, 기존 Episode 렌더(007 앞 10초) 정상 → 회귀 없음
- 비용: 0원
- 씬: `remotion/src/spike/SpikeC.tsx` — 파이프라인 7단계(기획→대본→나레이션→B-roll→터미널 캐스트→렌더→업로드) 블록이 14프레임 간격으로 spring 낙하하며 쌓이고 카메라가 ±0.55rad 공전. 어두운 배경 + 쿨블루 조명. 블록 글자는 3D 텍스트가 아니라 같은 카메라 행렬로 투영한 좌표에 얹는 2D 오버레이
- `--gl` 옵션별 결과(이 PC: Core Ultra 7 258V / Arc 140V). 전 옵션 렌더 성공, 결과 화면 동일. 실제 백엔드는 WebGL 렌더러 문자열로 확인:

  | `--gl` | 실제 백엔드 | SpikeC 웜 렌더 | 2D(SpikeA 웜 19초) 대비 |
  |---|---|---|---|
  | `angle` (공식 권장) | **Arc 140V GPU, D3D11** | 16초 | **0.84배** |
  | `vulkan` | **Arc 140V GPU, Vulkan** | 16초 | 0.84배 |
  | (미지정, 4.0 기본 `null`) | SwiftShader(소프트웨어) | 27초 | 1.42배 |
  | `egl` | Microsoft Basic Render Driver(소프트웨어) | 22초 | 1.16배 |
  | `swiftshader` | Microsoft Basic Render Driver(소프트웨어) | 25초 | 1.32배 |
  | `swangle` | SwiftShader(소프트웨어) | 43초 | 2.26배 |

- 렌더 시간(콜드/웜): 콜드(소스에서 직접, 번들링 포함) SpikeC angle **17초**. 번들 단독 6초. 웜(미리 만든 번들) 위 표. 참고로 SpikeA 콜드 74초는 spike 엔트리의 최초 rspack 캐시 생성까지 포함한 값이라 콜드끼리 배수(0.23배)는 의미 없음 → **웜 기준 0.84배가 대표값**
- 실패율: 0/8 (콜드 1 + 웜 6옵션 + 2D 기준 1). Remotion 종료 시 "Was not able to close puppeteer page" 경고는 기존 렌더에도 뜨는 무해한 로그
- 주의: 공식 문서는 Remotion 4.0에서 three.js가 기본 렌더러로 동작하지 않는다고 하지만, 이 PC에서는 기본값도 SwiftShader로 폴백해 화면은 나왔음. 다만 1.7배 느리고(27초 vs 16초) 셰이더·후처리가 늘면 격차가 벌어질 것
- ③단계에 넣는다면 필요한 것: (1) 3D 씬 렌더에 `--gl=angle` 명시 — `remotion.config.ts`의 `Config.setChromiumOpenGlRenderer("angle")`가 공식 권장이지만 기존 2D 렌더에도 영향이 가므로 2단계에서 render.ts에 반영할지 결정(이번엔 미변경). (2) 블록·라벨 데이터(단계명·색)를 script.json 씬 props로 받도록 일반화 — 지금은 상수. (3) 라벨 투영은 "블록 중심이 공전축 위"라는 전제에 기대고 있음 → 축 밖 오브젝트에 라벨을 달려면 공전 각도를 투영에 포함해야 함. (4) angle은 긴 렌더에서 메모리 누수가 알려져 있으므로(공식 문서) 1분 이상 3D 씬은 분할 렌더 검토. (5) 장면 연출 레퍼토리(쌓기·공전 외)는 씬 타입 1~2개로 한정해 시작
- 샘플 경로: `spike/C_3d/render/SpikeC_cold_angle.mp4`, `SpikeC_{angle,default,swangle,swiftshader,vulkan,egl}.mp4`, `SpikeA_warm.mp4`(전부 gitignore)
