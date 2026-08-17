import fs from "node:fs";
import path from "node:path";
import { REMOTION_DIR } from "./paths";

/**
 * Minimal .env loader (KEY=VALUE per line, # comments, no interpolation) —
 * avoids adding a dotenv dependency for a single-key use case. Does not
 * override variables already set in the environment.
 */
export function loadEnv(): void {
  const envPath = path.join(REMOTION_DIR, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
