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

/** Exported for testing. */
export function buildPrompt(topic: string, format: "shorts" | "long", projectId: string): string {
  const promptTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, "script_prompt_template.md"), "utf-8");
  const clips = loadExistingClips();
  return promptTemplate
    .replace("{{TOPIC}}", topic)
    .replace("{{FORMAT}}", format)
    .replace("{{PROJECT_ID}}", projectId)
    .replace("{{EXISTING_CLIPS}}", Object.entries(clips).map(([id, c]) => `    - ${id}: ${c.description}`).join(NEWLINE))
    .replace("{{ALLOWED_COMMANDS}}", ALLOWED_COMMAND_EXAMPLES.map((l) => `    - ${l}`).join(NEWLINE));
}

export function generateScript(
  runner: CliRunner,
  topic: string,
  format: "shorts" | "long",
  projectId: string,
): Record<string, unknown> {
  const prompt = buildPrompt(topic, format, projectId);
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
    throw new Error(`Generated script failed schema validation:\n${errors.join("\n")}`);
  }
  return script;
}
