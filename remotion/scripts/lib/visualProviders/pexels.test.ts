import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { excludedPexelsIds } from "./pexels";

describe("excludedPexelsIds (device ②)", () => {
  it("skips clips used in this project and in any other episode in the ledger", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pexels-"));
    try {
      fs.writeFileSync(path.join(dir, "s1-broll.credit.json"), JSON.stringify({ pexelsId: 11 }));
      const ledger = { episodes: { "008_ai_visual": { aiImagePrompts: [], existingClips: [], pexelsIds: [39425776], diagramKinds: [] } } };
      expect([...excludedPexelsIds(dir, ledger, "010_new")].sort()).toEqual([11, 39425776]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
