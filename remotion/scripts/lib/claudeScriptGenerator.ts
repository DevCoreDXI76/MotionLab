import fs from "node:fs";
import path from "node:path";
import { TEMPLATES_DIR } from "./paths";
import { validateScript } from "./scriptSchema";
import type { CliRunner } from "./claudeCliRunner";
import { loadExistingClips } from "./visualProviders/existingClip";

// Filled in by later pipeline steps (TTS, visual providers) — never authored by the model, so they're
// removed from the schema handed to `claude -p` instead of relying on a prompt instruction to omit them.
const RUNTIME_SCENE_FIELDS = ["durationMs", "audioPath"];
const RUNTIME_VISUAL_FIELDS = ["assetPath", "source"];

/** The full script schema minus runtime-only fields (docs/2단계_설계.md §2.3). Exported for testing. */
export function buildAuthoringSchema(): Record<string, unknown> {
  const schemaPath = path.join(TEMPLATES_DIR, "script_schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  const { $schema, title, ...jsonSchema } = schema;
  const sceneProps = jsonSchema.properties.scenes.items.properties;
  for (const field of RUNTIME_SCENE_FIELDS) delete sceneProps[field];
  for (const field of RUNTIME_VISUAL_FIELDS) delete sceneProps.visual.properties[field];
  return jsonSchema;
}

// Shown to the script writer; the real gate is lib/castCommandPolicy.ts.
const ALLOWED_COMMAND_EXAMPLES = [
  'git log --oneline -5 / git show --stat HEAD / git diff --stat / git status --short  (cwd "root")',
  'npx vitest run <테스트 파일 경로>  (cwd "remotion")',
  'grep -n <패턴> <파일> / head -n <숫자> <파일> / wc -l <파일> / ls <폴더> / cat <파일>  (cwd "root")',
  "secrets·.env·token 같은 단어나 절대경로·상위 폴더(..)가 들어간 인자는 거부됩니다.",
];

const NEWLINE = String.fromCharCode(10);

export interface ScriptPromptOptions {
  /** Full concept.md text — 2기 episodes are written from it instead of a one-line topic. */
  concept?: string;
  /** Errors from the previous attempt, fed back so a retry fixes them (orchestrator, §5.2). */
  feedback?: string[];
}

function conceptSection(concept: string | undefined): string {
  if (!concept) return "";
  return [
    "",
    "아래 concept.md가 이 편의 기획서입니다. 대본의 사실·수치·흐름은 모두 여기서 가져오고, concept.md에 없는 사실이나 숫자는 지어내지 마세요. concept.md의 씬 배정 표가 있으면 그 순서와 의도를 따르되, 비주얼 종류와 개수는 아래 요구 사항의 규칙이 우선합니다.",
    "",
    "<concept>",
    concept.trim(),
    "</concept>",
    "",
  ].join(NEWLINE);
}

function feedbackSection(feedback: string[] | undefined): string {
  if (!feedback || feedback.length === 0) return "";
  return [
    "",
    "이전에 생성한 대본이 아래 검증에서 실패했습니다. 이 문제를 모두 고친 대본을 처음부터 다시 작성하세요:",
    ...feedback.map((f) => `- ${f}`),
    "",
  ].join(NEWLINE);
}

/** Exported for testing. */
export function buildPrompt(topic: string, format: "shorts" | "long", projectId: string, options: ScriptPromptOptions = {}): string {
  const promptTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, "script_prompt_template.md"), "utf-8");
  const clips = loadExistingClips();
  return promptTemplate
    .replace("{{CONCEPT_SECTION}}", conceptSection(options.concept))
    .replace("{{FEEDBACK_SECTION}}", feedbackSection(options.feedback))
    .replace("{{TOPIC}}", topic)
    .replace("{{FORMAT}}", format)
    .replace("{{PROJECT_ID}}", projectId)
    .replace("{{EXISTING_CLIPS}}", Object.entries(clips).map(([id, c]) => `    - ${id}: ${c.description}`).join(NEWLINE))
    .replace("{{ALLOWED_COMMANDS}}", ALLOWED_COMMAND_EXAMPLES.map((l) => `    - ${l}`).join(NEWLINE));
}

/** The model answered, but the script doesn't validate — the orchestrator feeds `errors` back and retries. */
export class ScriptValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(["Generated script failed schema validation:", ...errors].join(NEWLINE));
  }
}

export function generateScript(
  runner: CliRunner,
  topic: string,
  format: "shorts" | "long",
  projectId: string,
  options: ScriptPromptOptions = {},
): Record<string, unknown> {
  const prompt = buildPrompt(topic, format, projectId, options);
  const schema = buildAuthoringSchema();

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
    throw new ScriptValidationError(errors);
  }
  return script;
}
