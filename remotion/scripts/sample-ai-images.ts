#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildImagePrompt, candidateSeed, CloudflareKleinGenerator, fitTo1080x1920, GEN_HEIGHT, GEN_WIDTH } from "./lib/visualProviders/aiImage";
import { estimateKleinNeurons, NeuronLedger } from "./lib/visualProviders/neuronLedger";
import { PixelRuleJudge } from "./lib/candidateJudge";

/**
 * Generates one klein image per prompt with the production style suffix and runs the production
 * pixel judge on it — for checking prompt/style rule changes before they reach an episode (D8).
 * Writes <outDir>/<id>.jpg and <outDir>/manifest.json (with empty human-review fields to fill in).
 *
 * Usage: npx tsx scripts/sample-ai-images.ts <outDir> (reads <outDir>/prompts.json: [{id, prompt}])
 */
async function main() {
  const outDir = path.resolve(process.argv[2] ?? "");
  const prompts = JSON.parse(fs.readFileSync(path.join(outDir, "prompts.json"), "utf-8")) as Array<{ id: string; prompt: string }>;
  const generator = new CloudflareKleinGenerator();
  const ledger = new NeuronLedger();
  const judge = new PixelRuleJudge();
  const manifest = [];
  for (const { id, prompt } of prompts) {
    const fullPrompt = buildImagePrompt(prompt);
    const seed = candidateSeed("d8_check", id, 0, 0);
    const est = estimateKleinNeurons(GEN_WIDTH, GEN_HEIGHT);
    ledger.assertBudget(est);
    let image: Buffer;
    try {
      image = await generator.generate(fullPrompt, seed, GEN_WIDTH, GEN_HEIGHT);
    } finally {
      ledger.record({ model: generator.model, width: GEN_WIDTH, height: GEN_HEIGHT, neuronsEst: est, project: "d8_check", scene: id, ok: true });
    }
    const raw = path.join(outDir, `${id}.raw.jpg`);
    const file = path.join(outDir, `${id}.jpg`);
    fs.writeFileSync(raw, image);
    fitTo1080x1920(raw, file);
    fs.rmSync(raw);
    const [judged] = await judge.judge([{ file: `${id}.jpg`, absPath: file, seed, round: 0 }]);
    manifest.push({
      id,
      prompt,
      fullPrompt,
      seed,
      model: generator.model,
      file: `${id}.jpg`,
      pixelJudge: { verdict: judged.verdict, reasons: judged.reasons, findings: judged.findings },
      review: { face_visible: null, hand_distortion: null, readable_fake_text: null, white_border: null, note: "" },
    });
    console.log(`${id}: seed ${seed}, pixel judge ${judged.verdict} ${judged.reasons.join("; ")} (today ~${ledger.usedToday()})`);
  }
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
