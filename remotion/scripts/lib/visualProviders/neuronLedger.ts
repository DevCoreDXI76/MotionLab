import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths";

// Cloudflare Workers AI free allocation (developers.cloudflare.com/workers-ai/platform/pricing,
// checked 2026-10-29). Free plan errors out instead of billing past the allocation; we stop
// ourselves at 80% so a mis-estimate never even reaches that error. Resets 00:00 UTC.
export const DAILY_FREE_NEURONS = 10_000;
export const STOP_RATIO = 0.8;

const KLEIN_NEURONS_PER_OUTPUT_TILE = 26.05;

/** Conservative tile count (ceil per axis), same as the 008 spike's estimate — klein 1072x1920 ≈ 312.6. */
export function estimateKleinNeurons(width: number, height: number): number {
  const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
  return Math.round(tiles * KLEIN_NEURONS_PER_OUTPUT_TILE * 10) / 10;
}

export interface LedgerEntry {
  utc: string;
  model: string;
  width: number;
  height: number;
  neuronsEst: number;
  project: string;
  scene: string;
  ok: boolean;
}

export class QuotaGuardError extends Error {}

export class NeuronLedger {
  constructor(private readonly filePath = path.join(DATA_DIR, "cloudflare_neurons.jsonl")) {}

  entries(): LedgerEntry[] {
    if (!fs.existsSync(this.filePath)) return [];
    return fs
      .readFileSync(this.filePath, "utf-8")
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as LedgerEntry);
  }

  /** Includes failed calls too: a request that timed out may still have been charged. */
  usedToday(now = new Date()): number {
    const today = now.toISOString().slice(0, 10);
    const sum = this.entries()
      .filter((e) => e.utc.startsWith(today))
      .reduce((acc, e) => acc + e.neuronsEst, 0);
    return Math.round(sum * 10) / 10;
  }

  assertBudget(nextEstimate: number, now = new Date()): void {
    const used = this.usedToday(now);
    const budget = DAILY_FREE_NEURONS * STOP_RATIO;
    if (used + nextEstimate > budget) {
      throw new QuotaGuardError(`Cloudflare neuron guard: today ~${used} + next ~${nextEstimate} would exceed ${budget}.`);
    }
  }

  record(entry: Omit<LedgerEntry, "utc">, now = new Date()): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, JSON.stringify({ utc: now.toISOString(), ...entry }) + "\n");
  }
}
