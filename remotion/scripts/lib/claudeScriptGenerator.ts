import fs from "node:fs";
import path from "node:path";
import { TEMPLATES_DIR } from "./paths";
import { validateScript } from "./scriptSchema";
import type { CliRunner } from "./claudeCliRunner";

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
