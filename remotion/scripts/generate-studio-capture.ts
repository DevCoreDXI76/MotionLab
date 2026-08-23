#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { assertPortFree, startStudio, stopStudio, waitForStudioReady } from "./lib/studioServer";
import { PROJECTS_DIR, PUBLIC_DIR, REMOTION_DIR } from "./lib/paths";

const VIEWPORT = { width: 1000, height: 900 }; // matches the earlier hand-recorded studio-demo.mp4
const RECORD_SECONDS = 17;
const DEFAULT_PORT = 7788; // distinct from `npm run dev`'s default so both can't collide

/**
 * Records ~17s of the *real* Remotion Studio playing an episode's actual
 * composition (title card -> talking points -> b-roll -> code scene) and
 * wires the clip into a scene's `visual.assetPath` — the "① Remotion Studio
 * 동작 화면" source from docs/002_test_리뷰_개선백로그.md.
 *
 * Security note (see docs/remotion_트레이드오프_claudecode인계.md 항목 15):
 * this does NOT capture the desktop or any window. Playwright's recordVideo
 * only records the viewport of a browser page this script opened itself,
 * pointed at a Remotion Studio instance this script also launched on
 * localhost — never a login-bearing site, never the live desktop. That
 * structural scoping is the documented exception to the screen-capture ban.
 *
 * Usage: npx tsx scripts/generate-studio-capture.ts <projectId> <sceneId> [port]
 */
async function main() {
  const [projectId, sceneId, portArg] = process.argv.slice(2);
  if (!projectId || !sceneId) {
    console.error("Usage: npx tsx scripts/generate-studio-capture.ts <projectId> <sceneId> [port]");
    process.exit(1);
  }
  const port = portArg ? Number(portArg) : DEFAULT_PORT;

  const scriptPath = path.join(PROJECTS_DIR, projectId, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const scene = script.scenes.find((s: { id: string }) => s.id === sceneId);
  if (!scene) {
    console.error(`Scene "${sceneId}" not found in ${scriptPath}.`);
    process.exit(1);
  }

  await assertPortFree(port);

  console.log(`Starting Remotion Studio on port ${port} with ${projectId}'s real script.json as props...`);
  const studio = await startStudio({ propsPath: scriptPath, port, cwd: REMOTION_DIR });

  const videosDir = path.join(PUBLIC_DIR, "projects", projectId, "videos");
  fs.mkdirSync(videosDir, { recursive: true });
  const filename = `${sceneId}-studio.webm`;
  const outPath = path.join(videosDir, filename);

  let recordedPath: string | null = null;
  try {
    await waitForStudioReady(studio.url);
    console.log(`Studio ready at ${studio.url}. Recording ${RECORD_SECONDS}s of real playback...`);

    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        recordVideo: { dir: videosDir, size: VIEWPORT },
      });
      const page = await context.newPage();
      await page.goto(studio.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000); // let the composition hydrate before we start driving it

      // Coordinate click, not a selector: Studio's Play button carries a real
      // title="Play" attribute (confirmed via DOM dump), but Playwright
      // locator.click() hangs waiting on it in this recordVideo-enabled
      // context specifically — likely the preview canvas's own global
      // pointer-event handling interferes with actionability polling.
      // Coordinates below are tuned against this project's Studio layout at
      // the VIEWPORT size above; re-tune if the Studio UI changes.
      const PLAY_BUTTON = { x: 391, y: 660 };

      await page.mouse.click(PLAY_BUTTON.x, PLAY_BUTTON.y);
      await page.waitForTimeout(RECORD_SECONDS * 1000);

      await page.close(); // finalizes the recorded video file
      recordedPath = (await page.video()?.path()) ?? null;
      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    stopStudio(studio.proc);
  }

  if (!recordedPath || !fs.existsSync(recordedPath)) {
    throw new Error("Playwright did not produce a recorded video file.");
  }
  fs.renameSync(recordedPath, outPath);
  console.log(`Recorded -> ${outPath}`);

  scene.visual = { ...scene.visual, assetPath: `projects/${projectId}/videos/${filename}` };
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  console.log(`Wired ${sceneId}.visual.assetPath in ${scriptPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
