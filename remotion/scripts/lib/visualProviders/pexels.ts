import fs from "node:fs";
import path from "node:path";
import { searchPortraitVideo } from "../pexels";
import { PUBLIC_DIR } from "../paths";
import { readSecret } from "../secrets";
import type { ProviderContext, ProviderResult } from "./types";

export function readPexelsApiKey(): string {
  return readSecret("pexels_api_key.txt", "PEXELS_API_KEY");
}

/** Pexels ids already used anywhere in this project (from *.credit.json sidecars) — b-roll diversity, commit a6c84dd. */
export function usedPexelsIds(videosDir: string): Set<number> {
  if (!fs.existsSync(videosDir)) return new Set();
  return new Set(
    fs
      .readdirSync(videosDir)
      .filter((f) => f.endsWith(".credit.json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(videosDir, f), "utf-8")).pexelsId)
      .filter((id): id is number => typeof id === "number"),
  );
}

/**
 * Searches Pexels for `query`, downloads the first clip passing the resolution/face/reuse filters
 * into public/projects/<id>/videos/<sceneId>-broll.mp4 and writes its credit sidecar. Returns null
 * when nothing passes (callers decide whether to try another query or fall back).
 */
export async function fetchPexelsBroll(
  ctx: ProviderContext,
  query: string,
  apiKey: string,
  options: { allowFaceCloseup?: boolean } = {},
): Promise<ProviderResult | null> {
  const videosDir = path.join(PUBLIC_DIR, "projects", ctx.projectId, "videos");
  fs.mkdirSync(videosDir, { recursive: true });
  const excludeIds = usedPexelsIds(videosDir);
  if (excludeIds.size > 0) {
    ctx.log(`Excluding ${excludeIds.size} already-used clip(s) from this project: ${[...excludeIds].join(", ")}`);
  }

  ctx.log(`Searching Pexels for "${query}" (portrait)...`);
  const result = await searchPortraitVideo(query, apiKey, excludeIds, options.allowFaceCloseup ?? false);
  if (!result) {
    ctx.log(`No portrait mp4 result found for "${query}" (after excluding already-used clips).`);
    return null;
  }
  ctx.log(`Found ${result.width}x${result.height} clip by ${result.photographer} (${result.pageUrl})`);

  const filename = `${ctx.sceneId}-broll.mp4`;
  const outPath = path.join(videosDir, filename);
  const videoResponse = await fetch(result.downloadUrl, { signal: AbortSignal.timeout(120_000) });
  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Failed to download clip: HTTP ${videoResponse.status}`);
  }
  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  ctx.log(`Downloaded ${(buffer.length / 1024).toFixed(0)} KB -> ${outPath}`);

  // Attribution sidecar — not required by Pexels' license, but we told them
  // we'd credit clips in the video description when requesting the API key.
  fs.writeFileSync(
    path.join(videosDir, `${ctx.sceneId}-broll.credit.json`),
    JSON.stringify({ pexelsId: result.id, photographer: result.photographer, pexelsUrl: result.pageUrl, query }, null, 2),
  );

  return {
    assetPath: `projects/${ctx.projectId}/videos/${filename}`,
    source: {
      provider: "pexels",
      selectedBy: "auto-rule",
      query,
      pexelsId: result.id,
      photographer: result.photographer,
      pageUrl: result.pageUrl,
      width: result.width,
      height: result.height,
      generatedAt: new Date().toISOString(),
    },
  };
}
