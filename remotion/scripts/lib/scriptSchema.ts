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
