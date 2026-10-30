#!/usr/bin/env node
import { runPipeline } from "./lib/pipeline/runPipeline";

/**
 * Single entry point for a 2기 episode (backlog 7): projects/<id>/concept.md in, private YouTube
 * upload out. A person writes concept.md (①) and reviews the private video (⑦); everything in
 * between retries or falls back on its own (docs/2단계_설계.md §5). Every run appends a report to
 * projects/<id>/log.md.
 *
 * Usage: npx tsx scripts/produce.ts <projectId> [--dry-run]
 *   --dry-run  everything except the YouTube upload
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [projectId] = args.filter((a) => !a.startsWith("--"));
  if (!projectId) {
    console.error("Usage: npx tsx scripts/produce.ts <projectId> [--dry-run]");
    process.exit(1);
  }
  const report = await runPipeline(projectId, { dryRun });
  process.exit(report.steps.some((s) => s.status === "failed") ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
