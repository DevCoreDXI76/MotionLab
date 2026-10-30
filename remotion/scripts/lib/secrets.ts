import fs from "node:fs";
import path from "node:path";
import { SECRETS_DIR } from "./paths";

const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/**
 * Reads a KEY=VALUE secrets file from secrets/ (the only place keys live — see
 * docs/2단계_설계.md D4). Values are never logged; callers that surface errors
 * should pass messages through maskSecrets() first.
 */
export function readSecretFile(fileName: string, secretsDir = SECRETS_DIR): Record<string, string> {
  const filePath = path.join(secretsDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`secrets/${fileName} not found.`);
  }
  const values: Record<string, string> = {};
  for (const rawLine of stripBom(fs.readFileSync(filePath, "utf-8")).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && value) values[key] = value;
  }
  return values;
}

export function readSecret(fileName: string, key: string, secretsDir = SECRETS_DIR): string {
  const value = readSecretFile(fileName, secretsDir)[key];
  if (!value) {
    throw new Error(`${key} not set in secrets/${fileName}.`);
  }
  return value;
}

/** Every value in every secrets/*.txt file — what maskSecrets() scrubs. JSON secret files are left to their own tools. */
export function loadAllSecretValues(secretsDir = SECRETS_DIR): string[] {
  if (!fs.existsSync(secretsDir)) return [];
  return fs
    .readdirSync(secretsDir)
    .filter((f) => f.endsWith(".txt"))
    .flatMap((f) => Object.values(readSecretFile(f, secretsDir)))
    .filter((v) => v.length >= 8); // short values (e.g. a region name) would mask ordinary words
}

export function maskSecrets(text: string, secretValues: string[] = loadAllSecretValues()): string {
  return secretValues.reduce((acc, value) => acc.split(value).join("***"), text);
}
