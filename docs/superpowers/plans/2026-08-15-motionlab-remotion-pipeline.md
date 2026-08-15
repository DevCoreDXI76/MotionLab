# MotionLab Remotion 파이프라인 구축 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 소재 선정 이후 "대본 생성 → TTS 나레이션 → 씬 렌더링" 전 구간을 자동화하는 Remotion 기반 쇼츠(9:16) 영상 파이프라인을 모노레포로 구축한다.

**Architecture:** `remotion/`(Remotion 프로젝트) + `templates/`(스키마·프롬프트) + `projects/`(편당 데이터·산출물)로 이루어진 모노레포. 파이프라인은 `script.json 생성(Claude Code CLI, Max 플랜) → TTS 생성/duration 측정(edge-tts) → script.json에 duration 역주입 → remotion render CLI 호출` 순서로 고정된 단방향 흐름을 가진다. 씬 컴포넌트는 `sceneRegistry`를 통해 `script.json`의 `scene.type` 값으로 매핑되며, `width/height`를 props로 받아 쇼츠/롱폼 분기가 가능하도록 설계한다.

**Tech Stack:** Remotion 4 (create-video 스캐폴딩), TypeScript, Node 24, `msedge-tts`(TTS), `music-metadata`(오디오 duration 측정), Claude Code CLI 비대화형 모드(대본 생성 — 별도 API 과금 없음), `ajv`(JSON Schema 검증), `vitest`(테스트), `tsx`(CLI 스크립트 실행), Notion MCP(프로젝트 등록·기록).

**Spec:** [remotion_트레이드오프_claudecode인계.md](../../../remotion_트레이드오프_claudecode인계.md), [remotion_사이드트랙_프로젝트설정.md](../../../remotion_사이드트랙_프로젝트설정.md)

## Global Constraints

- 1차 최적화 포맷은 쇼츠(9:16) 우선. 씬 컴포넌트는 처음부터 `width/height`를 props로 받는다 (스펙 §1).
- 나레이션은 AI TTS로 완전 자동화한다 (스펙 §2).
- 씬 길이는 오디오 실측 길이 기준으로 자동 계산한다. 파이프라인 순서 `script.json 생성 → TTS 생성/duration 측정 → duration 역주입 → Remotion 렌더`를 절대 깨지 않는다 (스펙 §3).
- 비주얼은 1차에서 코드 기반 모션그래픽만 사용한다. 이미지 생성 API 연동은 포함하지 않는다 (스펙 §4).
- 자막 타이밍은 TTS duration 재사용만 사용한다. Whisper/STT 의존성을 추가하지 않는다 (스펙 §5).
- TTS 벤더는 **edge-tts**로 확정 (사용자 확인, 2026-08-15 — 스펙 기본값 ElevenLabs 대신 무료 벤더로 결정). `ttsProvider.generate(text) → {audioPath, durationMs}` 인터페이스로 어댑터를 분리한다.
- 렌더링은 1차에서 로컬 `remotion render` CLI 직접 호출만 사용한다. Lambda 관련 설정은 포함하지 않는다 (스펙 §7).
- 배포는 1차에서 수동 업로드만 지원한다. 산출물은 mp4 + 메타데이터 초안(txt)까지이며 업로드 API 연동은 하지 않는다 (스펙 §8).
- 레포 구조는 모노레포: `remotion/`, `projects/`, `templates/`, `docs/`가 나란히 존재한다 (스펙 §9).
- 데이터 스키마는 편당 단일 `script.json`이며 `templates/script_schema.json`을 기준으로 검증한다 (스펙 §10).
- 씬 컴포넌트는 타입별 공용 라이브러리(`TitleScene`, `TalkingPointScene`, `CodeScene`, `OutroScene`)로 구현하고 `sceneRegistry.ts`로 매핑한다 (스펙 §11).
- 대본 생성은 **완전 자동**으로 확정 (사용자 확인, 2026-08-15 — 스펙 기본값 반자동 대신).
- **[2026-08-15 추가]** 대본 생성 호출은 **별도 Anthropic API 연동 금지**. `ANTHROPIC_API_KEY`/`@anthropic-ai/sdk` 방식(종량 과금)은 사용하지 않고, 현재 구독 중인 **Claude Code Max 플랜**의 비대화형(print) 모드를 셸 아웃으로 호출해 과금을 플랜 한도 내로 묶는다. 정확한 CLI 호출 방식은 Task 6에서 확정한다.
- **[2026-08-15 추가]** 노션 이중 기록 의무: 모든 프로젝트는 Notion DB에 기록·관리되며, 모션랩도 예외 없이 **① "AI 비서 집무실"(프로젝트 DB `collection://1b2bd00c-065a-4ef1-b728-80c72788e5c0`)과 ② "Vibe Coding Study"(Projects DB `collection://85e1681f-20b4-4c7b-8c58-102f36151bec`) 두 곳 모두**에 Notion MCP로 등록한다. `.notion/다른-프로젝트-적용-가이드.md`의 로컬 `.notion/` 폴더·git hook 자동화는 이번 착수 범위에 포함하지 않고, 최초 프로젝트 레코드 생성만 수행한다(Task 0). 이후 루트 CLAUDE.md §5 규칙대로 실행 가능한 액션은 업무 DB에 등록하고 계획 DB와 연결한다.
- 스캐폴딩은 `npx create-video@latest`(blank 템플릿)를 사용한다 (스펙 §13).

---

### Task 0: Notion 프로젝트 이중 등록 (AI 비서 집무실 + Vibe Coding Study)

> **[2026-08-15 추가]** 사용자 지침: 모든 프로젝트는 Notion DB로 기록·관리되며, 모션랩도 착수 전에 ① "AI 비서 집무실" 프로젝트 DB와 ② "Vibe Coding Study" Projects DB **두 곳 모두**에 등록해야 한다. 이 태스크는 코드 파일을 만들지 않고 Notion MCP 도구 호출만 수행한다. `.notion/다른-프로젝트-적용-가이드.md`가 설명하는 로컬 `.notion/` 폴더 복사·git hook 자동화(커밋마다 Tasks 자동 기록)는 이번 범위에 포함하지 않는다 — 필요해지면 별도 태스크로 다룬다.

**Files:** 없음 (Notion MCP 호출만 수행)

**Interfaces:**
- Consumes: Notion MCP (`notion-create-pages`, `notion-update-page`).
- Produces: 두 Notion 페이지의 URL/ID — Task 7 완료 후 상태를 갱신할 때 재사용한다.

- [ ] **Step 1: "AI 비서 집무실" 프로젝트 DB에 항목 생성**

`notion-create-pages`를 다음 인자로 호출한다:

```json
{
  "parent": { "type": "data_source_id", "data_source_id": "1b2bd00c-065a-4ef1-b728-80c72788e5c0" },
  "pages": [
    {
      "properties": {
        "이름": "모션랩 (MotionLab)",
        "설명": "Claude+Remotion 기반 자동화 쇼츠 파이프라인 구축·학습 사이드 트랙. 김부장 채널과 별도 운영, 완성 기준(콘텐츠 3~5편) 충족 시 조건부 스핀오프 검토.",
        "상태": "시작 전",
        "우선순위": "자산가치",
        "유형": "자산",
        "카테고리": "N잡",
        "date:시작일:start": "2026-08-15",
        "date:시작일:is_datetime": 0
      },
      "content": "**스펙 문서**: docs/remotion_트레이드오프_claudecode인계.md, docs/remotion_사이드트랙_프로젝트설정.md\n**구현 플랜**: docs/superpowers/plans/2026-08-15-motionlab-remotion-pipeline.md\n**동시 등록**: Vibe Coding Study Projects DB에도 동일 프로젝트로 등록됨(학습 트랙 이중 기록)."
    }
  ]
}
```

생성된 페이지 URL을 기록해 둔다(다음 스텝에서 교차 링크로 사용).

- [ ] **Step 2: "Vibe Coding Study" Projects DB에 항목 생성**

`notion-create-pages`를 다음 인자로 호출한다:

```json
{
  "parent": { "type": "data_source_id", "data_source_id": "85e1681f-20b4-4c7b-8c58-102f36151bec" },
  "pages": [
    {
      "properties": {
        "프로젝트명": "모션랩 (MotionLab)",
        "한줄 소개": "Claude+Remotion 코드 기반 모션그래픽으로 쇼츠를 자동 생성하는 파이프라인 학습 프로젝트",
        "상태": "기획",
        "date:시작일:start": "2026-08-15",
        "기술 스택": ["Node.js", "TypeScript"],
        "사용 라이브러리": "Remotion, msedge-tts, music-metadata, ajv, vitest",
        "사용 스킬/MCP": "superpowers:writing-plans, superpowers:subagent-driven-development, Notion MCP",
        "프로젝트 구조": "모노레포 — remotion/(Remotion 앱+파이프라인 스크립트) · projects/(편별 script.json·산출물) · templates/(스키마·프롬프트) · docs/(기획 문서)"
      }
    }
  ]
}
```

- [ ] **Step 3: 두 페이지를 상호 참조로 연결**

Step 1에서 만든 "AI 비서 집무실" 프로젝트 페이지에 `notion-update-page`(`command: "update_properties"`)로 `외부 링크` 속성을 Step 2에서 만든 "Vibe Coding Study" 프로젝트 페이지 URL로 채운다. (Vibe Coding Study Projects DB에는 범용 외부 링크 필드가 없으므로 역방향 링크는 페이지 본문에 텍스트로만 남긴다 — Step 2의 `content`에 이미 반영됨.)

- [ ] **Step 4: 등록 확인**

두 데이터소스를 각각 `notion-query-data-sources`(SQL 모드)로 조회해 "모션랩" 행이 존재하는지 확인한다:

```sql
SELECT "이름", "상태" FROM "collection://1b2bd00c-065a-4ef1-b728-80c72788e5c0" WHERE "이름" = '모션랩 (MotionLab)'
SELECT "프로젝트명", "상태" FROM "collection://85e1681f-20b4-4c7b-8c58-102f36151bec" WHERE "프로젝트명" = '모션랩 (MotionLab)'
```

각각 1행씩 나오면 성공.

(참고: 루트 CLAUDE.md §5 규칙에 따라, 이후 Task 1~7을 실제 실행할 때 발생하는 액션 항목은 "AI 비서 집무실" 업무 DB(`collection://97715c9d-73fd-4840-ae39-7f96e7ff6c57`)에도 등록하고 계획 DB와 연결하는 것이 원칙이나, 그 세부 매핑은 이 플랜의 범위가 아니라 실제 실행 세션에서 사용자와 함께 정한다.)

---

### Task 1: 모노레포 스캐폴딩

**Files:**
- Create (via CLI): `remotion/` 전체 (create-video blank 템플릿)
- Create: `projects/.gitkeep`
- Create: `templates/.gitkeep`
- Move: `remotion_트레이드오프_claudecode인계.md` → `docs/remotion_트레이드오프_claudecode인계.md`
- Move: `remotion_사이드트랙_프로젝트설정.md` → `docs/remotion_사이드트랙_프로젝트설정.md`
- Modify: `.gitignore` (root — 컨트롤러가 `.notion/` 한 줄로 이미 생성해 둠, 여기서는 항목을 추가만 한다)

**Interfaces:**
- Produces: `remotion/` 디렉터리(자체 `package.json`, `src/Root.tsx`, `src/index.ts`, `remotion.config.ts`), 이후 모든 Task가 이 디렉터리 하위에 파일을 추가한다.

- [ ] **Step 1: MotionLab 루트에서 create-video 비대화형 스캐폴딩 실행**

```bash
cd "c:/MyProjects/02_Agent/MotionLab"
npx create-video@latest --yes --blank --no-tailwind remotion
```

- [ ] **Step 2: 스캐폴딩 결과 확인**

`remotion/src/Root.tsx`, `remotion/src/index.ts`, `remotion/package.json`, `remotion/remotion.config.ts`가 생성되었는지 확인한다.

- [ ] **Step 3: 나머지 모노레포 폴더 생성**

```bash
mkdir -p "c:/MyProjects/02_Agent/MotionLab/projects"
mkdir -p "c:/MyProjects/02_Agent/MotionLab/templates"
mkdir -p "c:/MyProjects/02_Agent/MotionLab/docs"
touch "c:/MyProjects/02_Agent/MotionLab/projects/.gitkeep"
touch "c:/MyProjects/02_Agent/MotionLab/templates/.gitkeep"
```

- [ ] **Step 4: 기존 기획 문서를 docs/로 이동**

```bash
git_root="c:/MyProjects/02_Agent/MotionLab"
mv "$git_root/remotion_트레이드오프_claudecode인계.md" "$git_root/docs/remotion_트레이드오프_claudecode인계.md"
mv "$git_root/remotion_사이드트랙_프로젝트설정.md" "$git_root/docs/remotion_사이드트랙_프로젝트설정.md"
```

- [ ] **Step 5: 루트 `.gitignore`에 항목 추가**

`.gitignore`는 컨트롤러가 저장소를 초기화할 때 이미 `.notion/` 한 줄로 만들어 두었다(그 폴더는 `.notion/다른-프로젝트-적용-가이드.md`의 명시적 규칙에 따라 절대 커밋하지 않는다). 아래 항목을 그 파일에 **추가**한다(기존 `.notion/` 줄은 지우지 말 것):

```gitignore
node_modules/
remotion/node_modules/
remotion/out/
projects/*/output/
projects/*/audio/
remotion/public/projects/
.env
```

(참고: `projects/*/audio/`와 `remotion/public/projects/`는 TTS로 생성되는 바이너리이므로 커밋하지 않는다. 편별 `script.json` 자체는 텍스트라 커밋 대상이다.)

- [ ] **Step 6: Remotion Studio가 뜨는지 수동 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npx remotion studio
```

브라우저가 열리고 기본 데모 컴포지션이 보이면 확인 후 `Ctrl+C`로 종료한다.

- [ ] **Step 7: 커밋** (저장소는 컨트롤러가 이미 `git init`과 베이스라인 커밋을 마쳐 두었으므로, 여기서는 이번 태스크의 변경분만 커밋한다 — `git init`을 다시 실행하지 않는다)

```bash
cd "c:/MyProjects/02_Agent/MotionLab"
git add .
git commit -m "chore: scaffold MotionLab monorepo (remotion + projects + templates + docs)"
```

---

### Task 2: 데이터 스키마 + 검증 유틸

**Files:**
- Create: `templates/script_schema.json`
- Create: `remotion/scripts/lib/paths.ts`
- Create: `remotion/scripts/lib/scriptSchema.ts`
- Test: `remotion/scripts/lib/scriptSchema.test.ts`
- Modify: `remotion/package.json` (devDependencies: `ajv`, `vitest`; scripts: `"test": "vitest run"`)

**Interfaces:**
- Produces: `validateScript(data: unknown): { valid: boolean; errors: string[] }` — Task 3, 4, 6에서 사용.
- Produces: `PROJECTS_DIR`, `TEMPLATES_DIR`, `PUBLIC_DIR`, `REMOTION_DIR` 경로 상수 — 이후 모든 CLI 스크립트가 사용.

- [ ] **Step 1: 의존성 설치**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npm install --save-dev ajv vitest @types/node
```

- [ ] **Step 2: `templates/script_schema.json` 작성**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MotionLab Episode Script",
  "type": "object",
  "required": ["id", "title", "format", "fps", "scenes"],
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "title": { "type": "string", "minLength": 1 },
    "format": { "type": "string", "enum": ["shorts", "long"] },
    "fps": { "type": "integer", "minimum": 1 },
    "width": { "type": "integer", "minimum": 1 },
    "height": { "type": "integer", "minimum": 1 },
    "scenes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "narration"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "type": { "type": "string", "enum": ["title", "talkingPoint", "code", "outro"] },
          "narration": { "type": "string", "minLength": 1 },
          "subtitleText": { "type": ["string", "null"] },
          "durationMs": { "type": ["number", "null"], "minimum": 0 },
          "audioPath": { "type": ["string", "null"] },
          "props": { "type": "object" }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 3: `remotion/scripts/lib/paths.ts` 작성**

```ts
import path from "node:path";

// remotion/scripts/lib -> remotion/ -> MotionLab/
export const REMOTION_DIR = path.resolve(__dirname, "..", "..");
export const ROOT_DIR = path.resolve(REMOTION_DIR, "..");
export const PROJECTS_DIR = path.join(ROOT_DIR, "projects");
export const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
export const PUBLIC_DIR = path.join(REMOTION_DIR, "public");
```

- [ ] **Step 4: 실패하는 테스트 작성 — `remotion/scripts/lib/scriptSchema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { validateScript } from "./scriptSchema";

const validScript = {
  id: "001_sample",
  title: "샘플 편",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "안녕하세요", subtitleText: null, durationMs: null, audioPath: null, props: { title: "안녕" } },
  ],
};

describe("validateScript", () => {
  it("accepts a minimal valid script", () => {
    const result = validateScript(validScript);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a script missing required fields", () => {
    const { id, ...withoutId } = validScript;
    const result = validateScript(withoutId);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("rejects an unknown scene type", () => {
    const bad = { ...validScript, scenes: [{ ...validScript.scenes[0], type: "unknownType" }] };
    const result = validateScript(bad);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 5: 테스트 실행하여 실패 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npx vitest run scripts/lib/scriptSchema.test.ts
```

기대 결과: `scriptSchema` 모듈이 없어 FAIL.

- [ ] **Step 6: `remotion/scripts/lib/scriptSchema.ts` 구현**

```ts
import fs from "node:fs";
import path from "node:path";
import Ajv, { ErrorObject } from "ajv";
import { TEMPLATES_DIR } from "./paths";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const schemaPath = path.join(TEMPLATES_DIR, "script_schema.json");
const schemaJson = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(schemaJson);

export function validateScript(data: unknown): ValidationResult {
  const valid = validateFn(data) as boolean;
  const errors = (validateFn.errors ?? []).map(
    (e: ErrorObject) => `${e.instancePath || "(root)"} ${e.message}`,
  );
  return { valid, errors };
}
```

- [ ] **Step 7: 테스트 실행하여 통과 확인**

```bash
npx vitest run scripts/lib/scriptSchema.test.ts
```

기대 결과: 3개 테스트 모두 PASS.

- [ ] **Step 8: `remotion/package.json`에 `"test": "vitest run"` 스크립트 추가**

- [ ] **Step 9: 커밋**

```bash
git add templates/script_schema.json remotion/scripts remotion/package.json remotion/package-lock.json
git commit -m "feat: add script.json schema and validation util"
```

---

### Task 3: TTS 어댑터(edge-tts) + duration 역주입 파이프라인

**Files:**
- Create: `remotion/scripts/lib/ttsProvider.ts`
- Create: `remotion/scripts/lib/ttsProviders/edgeTtsProvider.ts`
- Create: `remotion/scripts/lib/injectDurations.ts`
- Create: `remotion/scripts/generate-narration.ts`
- Test: `remotion/scripts/lib/injectDurations.test.ts`
- Modify: `remotion/package.json` (dependencies: `msedge-tts`, `music-metadata`, `tsx`)

**Interfaces:**
- Consumes: `validateScript` (Task 2), `PROJECTS_DIR`/`PUBLIC_DIR` (Task 2).
- Produces: `TtsProvider` 인터페이스 `{ generate(text: string, outPath: string): Promise<{ audioPath: string; durationMs: number }> }` — Task 6에서 재사용 가능한 패턴.
- Produces: `injectDurations(script, ttsProvider, audioOutDir, publicRelativeDir): Promise<ScriptData>` — Task 5(render)가 소비하는 `durationMs`/`audioPath`가 채워진 `script.json`을 만드는 핵심 로직.

- [ ] **Step 1: 의존성 설치**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npm install msedge-tts music-metadata
npm install --save-dev tsx
```

- [ ] **Step 2: `remotion/scripts/lib/ttsProvider.ts` 작성 (인터페이스, 벤더 교체 지점)**

```ts
export interface TtsResult {
  audioPath: string; // 실제 생성된 오디오 파일의 절대 경로
  durationMs: number;
}

export interface TtsProvider {
  generate(text: string, outPath: string): Promise<TtsResult>;
}
```

- [ ] **Step 3: 실패하는 테스트 작성 — `remotion/scripts/lib/injectDurations.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { injectDurations, type ScriptData } from "./injectDurations";
import type { TtsProvider, TtsResult } from "./ttsProvider";

class FakeTtsProvider implements TtsProvider {
  calls: Array<{ text: string; outPath: string }> = [];
  async generate(text: string, outPath: string): Promise<TtsResult> {
    this.calls.push({ text, outPath });
    return { audioPath: outPath, durationMs: text.length * 100 };
  }
}

const script: ScriptData = {
  id: "001_sample",
  title: "샘플",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "안녕하세요" },
    { id: "s2", type: "outro", narration: "다음편에 만나요" },
  ],
};

describe("injectDurations", () => {
  it("fills durationMs and audioPath for every scene using the given provider", async () => {
    const provider = new FakeTtsProvider();
    const result = await injectDurations(script, provider, "/tmp/audio", "projects/001_sample/audio");

    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0].durationMs).toBe("안녕하세요".length * 100);
    expect(result.scenes[0].audioPath).toBe("projects/001_sample/audio/s1.mp3");
    expect(provider.calls[0].outPath).toContain("s1.mp3");
  });

  it("does not mutate the original script object", async () => {
    const provider = new FakeTtsProvider();
    await injectDurations(script, provider, "/tmp/audio", "projects/001_sample/audio");
    expect(script.scenes[0].durationMs).toBeUndefined();
  });
});
```

- [ ] **Step 4: 테스트 실행하여 실패 확인**

```bash
npx vitest run scripts/lib/injectDurations.test.ts
```

기대 결과: `injectDurations` 모듈이 없어 FAIL.

- [ ] **Step 5: `remotion/scripts/lib/injectDurations.ts` 구현**

```ts
import path from "node:path";
import type { TtsProvider } from "./ttsProvider";

export interface Scene {
  id: string;
  type: string;
  narration: string;
  subtitleText?: string | null;
  durationMs?: number | null;
  audioPath?: string | null;
  props?: Record<string, unknown>;
}

export interface ScriptData {
  id: string;
  title: string;
  format: "shorts" | "long";
  fps: number;
  width?: number;
  height?: number;
  scenes: Scene[];
}

export async function injectDurations(
  script: ScriptData,
  ttsProvider: TtsProvider,
  audioOutDir: string,
  publicRelativeDir: string,
): Promise<ScriptData> {
  const scenes: Scene[] = [];
  for (const scene of script.scenes) {
    const absPath = path.join(audioOutDir, `${scene.id}.mp3`);
    const { durationMs } = await ttsProvider.generate(scene.narration, absPath);
    scenes.push({
      ...scene,
      durationMs,
      audioPath: `${publicRelativeDir}/${scene.id}.mp3`.replace(/\\/g, "/"),
    });
  }
  return { ...script, scenes };
}
```

- [ ] **Step 6: 테스트 실행하여 통과 확인**

```bash
npx vitest run scripts/lib/injectDurations.test.ts
```

기대 결과: 2개 테스트 모두 PASS.

- [ ] **Step 7: `remotion/scripts/lib/ttsProviders/edgeTtsProvider.ts` 구현 (edge-tts 실제 어댑터)**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { parseFile } from "music-metadata";
import type { TtsProvider, TtsResult } from "../ttsProvider";

const DEFAULT_VOICE = process.env.MOTIONLAB_TTS_VOICE ?? "ko-KR-SunHiNeural";

export class EdgeTtsProvider implements TtsProvider {
  private client: MsEdgeTTS | null = null;

  private async getClient(): Promise<MsEdgeTTS> {
    if (!this.client) {
      this.client = new MsEdgeTTS();
      await this.client.setMetadata(DEFAULT_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    }
    return this.client;
  }

  async generate(text: string, outPath: string): Promise<TtsResult> {
    const client = await this.getClient();
    const outDir = path.dirname(outPath);
    await fs.mkdir(outDir, { recursive: true });

    const { audioFilePath } = await client.toFile(outDir, text);
    await fs.rename(audioFilePath, outPath);

    const meta = await parseFile(outPath);
    const durationMs = Math.round((meta.format.duration ?? 0) * 1000);
    if (!durationMs) {
      throw new Error(`Failed to measure duration for generated audio: ${outPath}`);
    }

    return { audioPath: outPath, durationMs };
  }

  close(): void {
    this.client?.close();
    this.client = null;
  }
}
```

- [ ] **Step 8: `remotion/scripts/generate-narration.ts` CLI 작성**

```ts
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { injectDurations } from "./lib/injectDurations";
import { EdgeTtsProvider } from "./lib/ttsProviders/edgeTtsProvider";
import { validateScript } from "./lib/scriptSchema";
import { PROJECTS_DIR, PUBLIC_DIR } from "./lib/paths";

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: npx tsx scripts/generate-narration.ts <projectId>");
    process.exit(1);
  }

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const raw = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const { valid, errors } = validateScript(raw);
  if (!valid) {
    console.error("script.json is invalid:\n" + errors.join("\n"));
    process.exit(1);
  }

  const audioOutDir = path.join(PUBLIC_DIR, "projects", projectId, "audio");
  const provider = new EdgeTtsProvider();
  try {
    const updated = await injectDurations(raw, provider, audioOutDir, `projects/${projectId}/audio`);
    fs.writeFileSync(scriptPath, JSON.stringify(updated, null, 2));
    console.log(`Updated ${scriptPath} with ${updated.scenes.length} scene durations.`);
  } finally {
    provider.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 9: 커밋**

```bash
git add remotion/scripts remotion/package.json remotion/package-lock.json
git commit -m "feat: add edge-tts adapter and narration duration injection pipeline"
```

---

### Task 4: 씬 컴포넌트 라이브러리 + sceneRegistry + Episode 컴포지션

**Files:**
- Create: `remotion/src/components/SubtitleOverlay.tsx`
- Create: `remotion/src/components/scenes/types.ts`
- Create: `remotion/src/components/scenes/TitleScene.tsx`
- Create: `remotion/src/components/scenes/TalkingPointScene.tsx`
- Create: `remotion/src/components/scenes/CodeScene.tsx`
- Create: `remotion/src/components/scenes/OutroScene.tsx`
- Create: `remotion/src/sceneRegistry.ts`
- Create: `remotion/src/Episode.tsx`
- Test: `remotion/src/sceneRegistry.test.ts`
- Modify: `remotion/src/Root.tsx` (기존 데모 컴포지션 대체)

**Interfaces:**
- Consumes: 없음 (독립적인 프레젠테이션 레이어). `script.json`의 `scenes[].durationMs`가 채워져 있다고 가정(Task 3의 산출물).
- Produces: `resolveSceneComponent(type: string): React.FC<SceneProps<any>>` — Task 5(render)가 최종 검증하는 `Episode` 컴포지션이 사용.
- Produces: `Episode: React.FC<EpisodeProps>` — Root.tsx의 `<Composition component={Episode} .../>` 로 등록되는 진입점.

- [ ] **Step 1: `remotion/src/components/scenes/types.ts` 작성**

```ts
export interface SceneProps<T = Record<string, unknown>> {
  narration: string;
  subtitleText: string;
  audioSrc: string;
  props: T;
}
```

- [ ] **Step 2: `remotion/src/components/SubtitleOverlay.tsx` 작성**

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";

export const SubtitleOverlay: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 120 }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "12px 24px",
          borderRadius: 12,
          backgroundColor: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 40,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: `remotion/src/components/scenes/TitleScene.tsx` 작성**

```tsx
import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import type { SceneProps } from "./types";

export interface TitleSceneProps {
  title: string;
  subtitle?: string;
}

export const TitleScene: React.FC<SceneProps<TitleSceneProps>> = ({ subtitleText, audioSrc, props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, fps / 2], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#111", justifyContent: "center", alignItems: "center" }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <div style={{ transform: `scale(${scale})`, opacity, textAlign: "center", color: "#fff" }}>
        <h1 style={{ fontSize: 72, margin: 0 }}>{props.title}</h1>
        {props.subtitle ? <h2 style={{ fontSize: 36, fontWeight: 400 }}>{props.subtitle}</h2> : null}
      </div>
      <SubtitleOverlay text={subtitleText} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: `remotion/src/components/scenes/TalkingPointScene.tsx` 작성**

```tsx
import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import type { SceneProps } from "./types";

export interface TalkingPointSceneProps {
  heading: string;
  bullets: string[];
}

export const TalkingPointScene: React.FC<SceneProps<TalkingPointSceneProps>> = ({
  subtitleText,
  audioSrc,
  props,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d1117", padding: 80, color: "#fff" }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <h2 style={{ fontSize: 56 }}>{props.heading}</h2>
      <ul style={{ fontSize: 40, lineHeight: 1.6 }}>
        {props.bullets.map((bullet, i) => {
          const delay = i * fps * 0.4;
          const opacity = interpolate(frame, [delay, delay + fps * 0.3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const translateX = interpolate(frame, [delay, delay + fps * 0.3], [-40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <li key={i} style={{ opacity, transform: `translateX(${translateX}px)` }}>
              {bullet}
            </li>
          );
        })}
      </ul>
      <SubtitleOverlay text={subtitleText} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 5: `remotion/src/components/scenes/CodeScene.tsx` 작성**

```tsx
import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import type { SceneProps } from "./types";

export interface CodeSceneProps {
  language: string;
  code: string;
  caption?: string;
}

export const CodeScene: React.FC<SceneProps<CodeSceneProps>> = ({ subtitleText, audioSrc, props }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1e1e1e", padding: 60, color: "#d4d4d4" }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      {props.caption ? <p style={{ fontSize: 32, color: "#9cdcfe" }}>{props.caption}</p> : null}
      <pre style={{ fontFamily: "Consolas, monospace", fontSize: 34, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        <code>{props.code}</code>
      </pre>
      <SubtitleOverlay text={subtitleText} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 6: `remotion/src/components/scenes/OutroScene.tsx` 작성**

```tsx
import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SubtitleOverlay } from "../SubtitleOverlay";
import type { SceneProps } from "./types";

export interface OutroSceneProps {
  message: string;
  ctaText?: string;
}

export const OutroScene: React.FC<SceneProps<OutroSceneProps>> = ({ subtitleText, audioSrc, props }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#111", justifyContent: "center", alignItems: "center", color: "#fff", opacity }}>
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 56 }}>{props.message}</h1>
        {props.ctaText ? <h3 style={{ fontSize: 32, color: "#8ab4f8" }}>{props.ctaText}</h3> : null}
      </div>
      <SubtitleOverlay text={subtitleText} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 7: 실패하는 테스트 작성 — `remotion/src/sceneRegistry.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { resolveSceneComponent } from "./sceneRegistry";
import { TitleScene } from "./components/scenes/TitleScene";

describe("resolveSceneComponent", () => {
  it("maps known scene types to their component", () => {
    expect(resolveSceneComponent("title")).toBe(TitleScene);
  });

  it("throws on an unknown scene type", () => {
    expect(() => resolveSceneComponent("nope")).toThrow(/Unknown scene type/);
  });
});
```

- [ ] **Step 8: 테스트 실행하여 실패 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npx vitest run src/sceneRegistry.test.ts
```

기대 결과: `sceneRegistry` 모듈이 없어 FAIL.

- [ ] **Step 9: `remotion/src/sceneRegistry.ts` 구현**

```ts
import type React from "react";
import { TitleScene } from "./components/scenes/TitleScene";
import { TalkingPointScene } from "./components/scenes/TalkingPointScene";
import { CodeScene } from "./components/scenes/CodeScene";
import { OutroScene } from "./components/scenes/OutroScene";
import type { SceneProps } from "./components/scenes/types";

export const sceneRegistry: Record<string, React.FC<SceneProps<any>>> = {
  title: TitleScene,
  talkingPoint: TalkingPointScene,
  code: CodeScene,
  outro: OutroScene,
};

export function resolveSceneComponent(type: string): React.FC<SceneProps<any>> {
  const component = sceneRegistry[type];
  if (!component) {
    throw new Error(`Unknown scene type: ${type}`);
  }
  return component;
}
```

- [ ] **Step 10: 테스트 실행하여 통과 확인**

```bash
npx vitest run src/sceneRegistry.test.ts
```

기대 결과: 2개 테스트 모두 PASS.

- [ ] **Step 11: `remotion/src/Episode.tsx` 작성 (컴포지션 본체)**

```tsx
import React from "react";
import { Series } from "remotion";
import { resolveSceneComponent } from "./sceneRegistry";

export interface Scene {
  id: string;
  type: string;
  narration: string;
  subtitleText?: string | null;
  durationMs?: number | null;
  audioPath?: string | null;
  props?: Record<string, unknown>;
}

export interface EpisodeProps {
  id: string;
  title: string;
  format: "shorts" | "long";
  fps: number;
  width?: number;
  height?: number;
  scenes: Scene[];
}

const FALLBACK_DURATION_MS = 3000; // Studio 프리뷰에서 duration 역주입 전에도 렌더가 깨지지 않도록 하는 임시값

export const Episode: React.FC<EpisodeProps> = ({ scenes, fps }) => {
  return (
    <Series>
      {scenes.map((scene) => {
        const durationMs = scene.durationMs ?? FALLBACK_DURATION_MS;
        const durationInFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
        const SceneComponent = resolveSceneComponent(scene.type);
        return (
          <Series.Sequence key={scene.id} durationInFrames={durationInFrames}>
            <SceneComponent
              narration={scene.narration}
              subtitleText={scene.subtitleText ?? scene.narration}
              audioSrc={scene.audioPath ?? ""}
              props={scene.props ?? {}}
            />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};
```

- [ ] **Step 12: `remotion/src/Root.tsx`를 덮어써서 `Episode` 컴포지션 등록**

```tsx
import React from "react";
import { Composition } from "remotion";
import { Episode, EpisodeProps } from "./Episode";

const DEFAULT_DIMENSIONS: Record<EpisodeProps["format"], { width: number; height: number }> = {
  shorts: { width: 1080, height: 1920 },
  long: { width: 1920, height: 1080 },
};

const SAMPLE_PROPS: EpisodeProps = {
  id: "preview",
  title: "미리보기",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "모션랩 파이프라인 미리보기", props: { title: "MotionLab" } },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Episode"
      component={Episode}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={90}
      defaultProps={SAMPLE_PROPS}
      calculateMetadata={async ({ props }) => {
        const format = props.format ?? "shorts";
        const dims = DEFAULT_DIMENSIONS[format];
        const fps = props.fps ?? 30;
        const durationInFrames = props.scenes.reduce((sum: number, scene) => {
          const durationMs = scene.durationMs ?? 3000;
          return sum + Math.max(1, Math.round((durationMs / 1000) * fps));
        }, 0);
        return {
          width: props.width ?? dims.width,
          height: props.height ?? dims.height,
          fps,
          durationInFrames,
        };
      }}
    />
  );
};
```

- [ ] **Step 13: Remotion Studio에서 육안 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npx remotion studio
```

"Episode" 컴포지션이 목록에 보이고, 프리뷰에서 타이틀 씬이 애니메이션과 함께 렌더되는지 확인 후 종료.

- [ ] **Step 14: 커밋**

```bash
git add remotion/src
git commit -m "feat: add scene component library, sceneRegistry, and Episode composition"
```

---

### Task 5: 메타데이터 초안 생성기 + 렌더 CLI

**Files:**
- Create: `remotion/scripts/lib/metadataDraft.ts`
- Create: `remotion/scripts/render.ts`
- Test: `remotion/scripts/lib/metadataDraft.test.ts`

**Interfaces:**
- Consumes: `validateScript` (Task 2), `PROJECTS_DIR`/`REMOTION_DIR` (Task 2), `Episode` 컴포지션 id `"Episode"` (Task 4).
- Produces: `generateMetadataDraft(script): string` — 산출물 `projects/<id>/output/<id>.metadata.txt`의 내용을 만든다.

- [ ] **Step 1: 실패하는 테스트 작성 — `remotion/scripts/lib/metadataDraft.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { generateMetadataDraft } from "./metadataDraft";

describe("generateMetadataDraft", () => {
  it("includes title, a narration-based summary, and shorts hashtags", () => {
    const draft = generateMetadataDraft({
      title: "코드로 만드는 쇼츠",
      format: "shorts",
      scenes: [{ narration: "오늘은 Remotion으로 쇼츠를 자동 생성하는 법을 알아봅니다." }],
    });
    expect(draft).toContain("코드로 만드는 쇼츠");
    expect(draft).toContain("Remotion으로 쇼츠를 자동 생성");
    expect(draft).toContain("#shorts");
  });

  it("uses long-form hashtags for the long format", () => {
    const draft = generateMetadataDraft({ title: "T", format: "long", scenes: [{ narration: "N" }] });
    expect(draft).not.toContain("#shorts");
  });
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npx vitest run scripts/lib/metadataDraft.test.ts
```

- [ ] **Step 3: `remotion/scripts/lib/metadataDraft.ts` 구현**

```ts
export interface MetadataDraftInput {
  title: string;
  format: "shorts" | "long";
  scenes: Array<{ narration: string }>;
}

export function generateMetadataDraft(script: MetadataDraftInput): string {
  const summary = script.scenes.map((s) => s.narration).join(" ").slice(0, 200);
  const hashtags = script.format === "shorts" ? "#shorts #모션랩 #자동화영상" : "#모션랩 #자동화영상";
  return [`제목: ${script.title}`, "", `설명: ${summary}`, "", `해시태그: ${hashtags}`].join("\n");
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

```bash
npx vitest run scripts/lib/metadataDraft.test.ts
```

- [ ] **Step 5: `remotion/scripts/render.ts` 작성**

```ts
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateScript } from "./lib/scriptSchema";
import { generateMetadataDraft } from "./lib/metadataDraft";
import { PROJECTS_DIR, REMOTION_DIR } from "./lib/paths";

function assertDurationsFilled(script: { scenes: Array<{ id: string; durationMs?: number | null }> }) {
  const missing = script.scenes.filter((s) => s.durationMs == null);
  if (missing.length > 0) {
    throw new Error(
      `Missing durationMs for scenes: ${missing.map((s) => s.id).join(", ")}. Run generate-narration first.`,
    );
  }
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: npx tsx scripts/render.ts <projectId>");
    process.exit(1);
  }

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const { valid, errors } = validateScript(script);
  if (!valid) {
    console.error("script.json is invalid:\n" + errors.join("\n"));
    process.exit(1);
  }
  assertDurationsFilled(script);

  const outputDir = path.join(PROJECTS_DIR, projectId, "output");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${projectId}.mp4`);

  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npxCmd,
    ["remotion", "render", "src/index.ts", "Episode", outputPath, `--props=${scriptPath}`],
    { cwd: REMOTION_DIR, stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error("remotion render failed.");
    process.exit(result.status ?? 1);
  }

  const draft = generateMetadataDraft(script);
  fs.writeFileSync(path.join(outputDir, `${projectId}.metadata.txt`), draft);
  console.log(`Rendered ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: 커밋**

```bash
git add remotion/scripts
git commit -m "feat: add metadata draft generator and render CLI"
```

(엔드투엔드 렌더 동작 검증은 Task 7에서 실제 `script.json`으로 수행한다.)

---

### Task 6: 대본 자동 생성 (완전 자동, Claude Code CLI — Max 플랜, 별도 API 과금 없음)

> **[2026-08-15 변경]** 최초안은 `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY`(종량 과금)였으나, 사용자가 별도 API 연동을 금지하고 기존 Claude Code Max 플랜 구독 한도 내에서 처리하도록 확정했다. 대신 `claude` CLI의 비대화형(print) 모드를 자식 프로세스로 호출한다. `claude -p --output-format json --json-schema '<schema>'`는 `structured_output` 필드에 스키마 검증까지 끝난 JSON을 돌려주므로 별도의 tool-use 프로토콜이 필요 없다. 이 CLI 호출은 `claude login`으로 인증된 세션(Max 플랜 시트)을 그대로 사용하며, 호출 시 환경에서 `ANTHROPIC_API_KEY`를 명시적으로 제거해 API 키가 우선 적용되어 종량 과금으로 새는 것을 방지한다.
>
> **주의(Step 8에서 검증 필요)**: `--json-schema`가 받아들이는 JSON Schema 기능의 범위(예: `type: ["string","null"]` 같은 유니언, 중첩 `additionalProperties: false`)는 문서로 확정 확인하지 못했다. 그래서 durationMs/audioPath는 nullable 필드로 요청하지 않고 프롬프트에서 아예 생략하도록 지시했다(Step 1). Step 8 스모크 테스트에서 `claude -p`가 `templates/script_schema.json`을 그대로 거부하면, 그 자리에서 스키마를 단순화(예: 유니언 제거, scene별 `oneOf` 대신 공통 `props: object`만 유지)해 재시도한다.

**Files:**
- Create: `templates/script_prompt_template.md`
- Create: `remotion/scripts/lib/claudeCliRunner.ts`
- Create: `remotion/scripts/lib/claudeScriptGenerator.ts`
- Create: `remotion/scripts/generate-script.ts`
- Test: `remotion/scripts/lib/claudeScriptGenerator.test.ts`

**Interfaces:**
- Consumes: `validateScript`, `TEMPLATES_DIR`, `PROJECTS_DIR` (Task 2).
- Produces: `CliRunner.run(args: string[]): { status, stdout, stderr }` — `claude` CLI 호출을 캡슐화하는 인터페이스(테스트에서 실제 프로세스 스폰 없이 대체 가능).
- Produces: `generateScript(runner, topic, format, projectId): Record<string, unknown>` — 검증까지 끝난 `script.json` 객체를 동기로 반환.

- [ ] **Step 1: `templates/script_prompt_template.md` 작성**

```md
당신은 "모션랩" 채널의 쇼츠 대본 작가입니다. 아래 주제로 코드 기반 모션그래픽 쇼츠 대본을 작성하세요.

- 주제: {{TOPIC}}
- 포맷: {{FORMAT}} (shorts = 9:16 세로, long = 16:9 가로)
- 프로젝트 ID: {{PROJECT_ID}}

요구 사항:
- 씬은 title → talkingPoint(1~3개) → outro 순서를 기본으로 하되, 코드 예시가 필요하면 talkingPoint 사이에 code 씬을 추가하세요.
- 각 씬의 narration은 실제 TTS로 읽힐 한국어 나레이션 문장입니다. 씬당 2~4문장으로 작성하세요.
- subtitleText는 비워도 됩니다(비우면 narration이 자막으로 그대로 쓰입니다).
- durationMs와 audioPath 필드는 아예 생략하세요(이후 파이프라인 단계에서 자동으로 채워집니다).
- 각 씬의 props는 scene.type에 맞는 필드를 채우세요:
  - title: { "title": string, "subtitle"?: string }
  - talkingPoint: { "heading": string, "bullets": string[] }
  - code: { "language": string, "code": string, "caption"?: string }
  - outro: { "message": string, "ctaText"?: string }
- 응답은 반드시 주어진 JSON 스키마를 만족하는 구조화된 출력으로만 제공하세요. 다른 설명 텍스트는 포함하지 마세요.
```

- [ ] **Step 2: 실패하는 테스트 작성 — `remotion/scripts/lib/claudeScriptGenerator.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { generateScript } from "./claudeScriptGenerator";
import type { CliRunner } from "./claudeCliRunner";

const VALID_SCRIPT = {
  id: "001_sample",
  title: "Remotion 자동화 쇼츠",
  format: "shorts",
  fps: 30,
  scenes: [
    { id: "s1", type: "title", narration: "안녕하세요, 모션랩입니다.", subtitleText: null, durationMs: null, audioPath: null, props: { title: "MotionLab" } },
    { id: "s2", type: "outro", narration: "다음 편에서 만나요.", subtitleText: null, durationMs: null, audioPath: null, props: { message: "다음 편에 만나요" } },
  ],
};

function fakeRunner(structuredOutput: unknown, status = 0): CliRunner {
  return {
    run: () => ({
      status,
      stdout: JSON.stringify({ structured_output: structuredOutput }),
      stderr: "",
    }),
  };
}

describe("generateScript", () => {
  it("returns a validated script object from structured_output", () => {
    const script = generateScript(fakeRunner(VALID_SCRIPT), "Remotion 소개", "shorts", "001_sample");
    expect(script).toEqual(VALID_SCRIPT);
  });

  it("throws when the claude CLI exits non-zero", () => {
    const runner: CliRunner = { run: () => ({ status: 1, stdout: "", stderr: "boom" }) };
    expect(() => generateScript(runner, "T", "shorts", "001_sample")).toThrow(/exited with status 1/);
  });

  it("throws when structured_output fails schema validation", () => {
    const runner = fakeRunner({ id: "x" }); // missing required fields
    expect(() => generateScript(runner, "T", "shorts", "001_sample")).toThrow(/schema validation/);
  });
});
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npx vitest run scripts/lib/claudeScriptGenerator.test.ts
```

- [ ] **Step 4: `remotion/scripts/lib/claudeCliRunner.ts` 구현 (Max 플랜 강제 — API 키 차단)**

```ts
import { spawnSync } from "node:child_process";

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface CliRunner {
  run(args: string[]): CliResult;
}

export class ClaudeCliRunner implements CliRunner {
  run(args: string[]): CliResult {
    // ANTHROPIC_API_KEY가 설정돼 있으면 claude -p가 이를 우선 사용해 종량 과금으로 전환된다.
    // Max 플랜 구독 한도 안에서만 쓰도록 자식 프로세스 환경에서 명시적으로 제거한다.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const claudeCmd = process.platform === "win32" ? "claude.cmd" : "claude";
    const result = spawnSync(claudeCmd, args, { encoding: "utf-8", env });
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  }
}
```

- [ ] **Step 5: `remotion/scripts/lib/claudeScriptGenerator.ts` 구현**

```ts
import fs from "node:fs";
import path from "node:path";
import { TEMPLATES_DIR } from "./paths";
import { validateScript } from "./scriptSchema";
import type { CliRunner } from "./claudeCliRunner";

function buildJsonSchema(): Record<string, unknown> {
  const schemaPath = path.join(TEMPLATES_DIR, "script_schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  const { $schema, title, ...jsonSchema } = schema;
  return jsonSchema;
}

function buildPrompt(topic: string, format: "shorts" | "long", projectId: string): string {
  const promptTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, "script_prompt_template.md"), "utf-8");
  return promptTemplate
    .replace("{{TOPIC}}", topic)
    .replace("{{FORMAT}}", format)
    .replace("{{PROJECT_ID}}", projectId);
}

export function generateScript(
  runner: CliRunner,
  topic: string,
  format: "shorts" | "long",
  projectId: string,
): Record<string, unknown> {
  const prompt = buildPrompt(topic, format, projectId);
  const schema = buildJsonSchema();

  const { status, stdout, stderr } = runner.run([
    "-p",
    prompt,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    "--allowedTools",
    "",
    "--permission-mode",
    "dontAsk",
  ]);

  if (status !== 0) {
    throw new Error(`claude -p exited with status ${status}: ${stderr}`);
  }

  let parsed: { structured_output?: unknown };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse claude -p JSON output: ${stdout}`);
  }

  if (!parsed.structured_output) {
    throw new Error(`claude -p response did not include structured_output: ${stdout}`);
  }

  const script = parsed.structured_output as Record<string, unknown>;
  const { valid, errors } = validateScript(script);
  if (!valid) {
    throw new Error(`Generated script failed schema validation:\n${errors.join("\n")}`);
  }
  return script;
}
```

- [ ] **Step 6: 테스트 실행하여 통과 확인**

```bash
npx vitest run scripts/lib/claudeScriptGenerator.test.ts
```

기대 결과: 3개 테스트 모두 PASS.

- [ ] **Step 7: `remotion/scripts/generate-script.ts` CLI 작성**

```ts
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { generateScript } from "./lib/claudeScriptGenerator";
import { ClaudeCliRunner } from "./lib/claudeCliRunner";
import { PROJECTS_DIR } from "./lib/paths";

function main() {
  const [projectId, topic, format = "shorts"] = process.argv.slice(2);
  if (!projectId || !topic) {
    console.error('Usage: npx tsx scripts/generate-script.ts <projectId> "<topic>" [shorts|long]');
    process.exit(1);
  }

  const script = generateScript(new ClaudeCliRunner(), topic, format as "shorts" | "long", projectId);

  const projectDir = path.join(PROJECTS_DIR, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  const outPath = path.join(projectDir, "script.json");
  fs.writeFileSync(outPath, JSON.stringify(script, null, 2));
  console.log(`Wrote ${outPath}`);
}

main();
```

- [ ] **Step 8: 실제 `claude` CLI 로그인 상태에서 1회 수동 실행해 종료 코드/출력 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
echo $ANTHROPIC_API_KEY   # 비어 있어야 함(설정돼 있으면 unset 후 재시도)
npx tsx scripts/generate-script.ts 001_smoke "Remotion 소개" shorts
```

`projects/001_smoke/script.json`이 생성되고 스키마를 통과하는지 확인한 뒤, 이 스모크 테스트용 폴더는 삭제한다(엔드투엔드 검증은 Task 7의 `001_sample`로 별도 수행).

- [ ] **Step 9: 커밋**

```bash
git add templates/script_prompt_template.md remotion/scripts
git commit -m "feat: add script generation via Claude Code CLI (Max plan, no separate API billing)"
```

---

### Task 7: 엔드투엔드 샘플 편 검증

**Files:**
- Create: `projects/001_sample/script.json` (`generate-script.ts` 실행 산출물)
- Create (산출물): `remotion/public/projects/001_sample/audio/*.mp3`
- Create (산출물): `projects/001_sample/output/001_sample.mp4`, `projects/001_sample/output/001_sample.metadata.txt`

**Interfaces:**
- Consumes: Task 2~6의 모든 CLI(`generate-script.ts`, `generate-narration.ts`, `render.ts`)를 순서대로 실행. `claude` CLI가 이 머신에서 이미 `claude login`(Max 플랜)으로 로그인돼 있다고 가정한다 — 로그인 안 돼 있으면 Step 2에서 실패하므로 그 경우 먼저 `claude login`을 실행한다.

- [ ] **Step 1: 전체 vitest 스위트 통과 확인**

```bash
cd "c:/MyProjects/02_Agent/MotionLab/remotion"
npx vitest run
```

기대 결과: Task 2, 3, 4, 5, 6에서 작성한 모든 테스트 PASS.

- [ ] **Step 2: 대본 생성 (Claude Code CLI, Max 플랜)**

```bash
npx tsx scripts/generate-script.ts 001_sample "Remotion으로 쇼츠 자동화하기" shorts
```

- [ ] **Step 3: `projects/001_sample/script.json`이 스키마를 통과하는지 확인**

```bash
npx tsx -e "
const fs = require('node:fs');
const { validateScript } = require('./scripts/lib/scriptSchema');
const script = JSON.parse(fs.readFileSync('../projects/001_sample/script.json', 'utf-8'));
const result = validateScript(script);
console.log(result);
if (!result.valid) process.exit(1);
"
```

- [ ] **Step 4: 나레이션 생성 (edge-tts 실제 호출)**

```bash
npx tsx scripts/generate-narration.ts 001_sample
```

`projects/001_sample/script.json`의 모든 씬에 `durationMs`(숫자)와 `audioPath`가 채워졌는지 확인한다.

- [ ] **Step 5: 렌더**

```bash
npx tsx scripts/render.ts 001_sample
```

- [ ] **Step 6: 산출물 확인**

`projects/001_sample/output/001_sample.mp4`가 생성되고 재생 시 나레이션과 씬 전환이 자연스럽게 맞아떨어지는지, `001_sample.metadata.txt`에 제목/설명/해시태그가 들어있는지 육안으로 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add projects/001_sample/script.json
git commit -m "docs: add end-to-end sample episode (001_sample)"
```

(`output/`, `remotion/public/projects/`는 `.gitignore`로 제외되므로 커밋되지 않는다.)

---

## Self-Review 메모

- **스펙 커버리지**: §1(width/height props) → Task 4 `EpisodeProps`/`Root.tsx`. §2(AI TTS 자동화) → Task 3. §3(오디오 실측 기준, 순서 고정) → Task 3+5+7의 실행 순서. §4(코드 기반 모션그래픽만) → Task 4에 이미지 API 없음. §5(STT 없음) → 자막은 `subtitleText ?? narration`만 사용. §6(TTS 벤더=edge-tts) → Task 3. §7(로컬 렌더 CLI) → Task 5 `render.ts`. §8(수동 배포, mp4+메타데이터까지) → Task 5 `metadataDraft`. §9(모노레포 구조) → Task 1. §10(단일 script.json+검증) → Task 2. §11(공용 컴포넌트+registry) → Task 4. §12(완전 자동 대본) → Task 6. §13(create-video) → Task 1. 모두 반영됨.
- **2026-08-15 추가 요구사항 커버리지**: (1) "별도 Anthropic API 연동 금지, Max 플랜 내에서" → Task 6을 `@anthropic-ai/sdk`/`ANTHROPIC_API_KEY`에서 `claude -p --output-format json --json-schema` 자식 프로세스 호출로 전면 재작성, `ClaudeCliRunner`가 환경에서 `ANTHROPIC_API_KEY`를 명시적으로 제거. (2) "AI 비서 집무실 + Vibe Coding Study 이중 기록" → Task 0을 최초 태스크로 추가, 두 데이터소스 ID·속성 스키마를 실제 Notion MCP 조회로 확인 후 반영, Global Constraints에도 규칙으로 명시.
- **플레이스홀더 스캔**: 각 Step에 실제 코드/명령이 포함되어 있으며 "TODO"/"적절히 처리" 류 표현 없음.
- **타입 일관성**: `Scene`/`ScriptData`(Task 3) ↔ `Scene`/`EpisodeProps`(Task 4)는 동일한 필드명(`id`, `type`, `narration`, `subtitleText`, `durationMs`, `audioPath`, `props`)을 사용하도록 맞춤. `TtsProvider.generate(text, outPath)` 시그니처는 Task 3 인터페이스·구현·테스트에서 동일하게 유지. `CliRunner.run(args): {status, stdout, stderr}` 시그니처는 Task 6의 인터페이스·구현·테스트에서 동일하게 유지.
