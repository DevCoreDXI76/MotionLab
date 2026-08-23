import { spawn, execSync, type ChildProcess } from "node:child_process";

export interface StudioHandle {
  proc: ChildProcess;
  url: string;
}

function trySpawn(command: string, args: string[], cwd: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: "pipe",
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    let settled = false;
    proc.once("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    proc.once("spawn", () => {
      if (!settled) {
        settled = true;
        resolve(proc);
      }
    });
  });
}

/**
 * Launches `npx remotion studio` in the background and leaves it running —
 * caller is responsible for calling stopStudio() when done.
 *
 * Mirrors spawnCli.ts's direct-spawn-then-cmd.exe-fallback strategy for
 * launching an npm .cmd shim on Windows (see that file's comments for why),
 * but async/non-blocking: this process needs to stay alive while Playwright
 * drives it, so spawnCli's spawnSync/stdio:"inherit" isn't usable here.
 */
export async function startStudio(opts: { propsPath: string; port: number; cwd: string }): Promise<StudioHandle> {
  const args = [
    "remotion",
    "studio",
    "src/index.ts",
    `--props=${opts.propsPath}`,
    `--port=${opts.port}`,
    "--no-open",
  ];

  let proc: ChildProcess;
  try {
    proc = await trySpawn("npx", args, opts.cwd);
  } catch (err) {
    const isWin = process.platform === "win32";
    if (isWin && (err as NodeJS.ErrnoException).code === "ENOENT") {
      proc = await trySpawn("cmd.exe", ["/d", "/s", "/c", "npx", ...args], opts.cwd);
    } else {
      throw err;
    }
  }
  // Drain stdio so the child's pipe buffers never fill up and stall it.
  proc.stdout?.on("data", () => {});
  proc.stderr?.on("data", () => {});

  return { proc, url: `http://localhost:${opts.port}` };
}

/** Polls the Studio's HTTP server until it responds or timeoutMs elapses. */
export async function waitForStudioReady(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Not listening yet — keep polling.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Studio did not become ready at ${url} within ${timeoutMs}ms.`);
}

/**
 * Fails fast if something (e.g. a `npm run dev` Studio the user left open) is
 * already listening on the target port, instead of silently recording
 * whatever that other instance happens to be showing.
 */
export async function assertPortFree(port: number): Promise<void> {
  try {
    await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1000) });
  } catch {
    return; // Connection failed -> port is free, which is what we want.
  }
  throw new Error(
    `Port ${port} is already in use (maybe another Remotion Studio / dev server?). Stop it or pass a different port.`,
  );
}

/** Kills the Studio process (and, on Windows, its full child tree — npx spawns a nested node process). */
export function stopStudio(proc: ChildProcess): void {
  if (proc.pid == null || proc.killed) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${proc.pid} /t /f`, { stdio: "ignore" });
    } catch {
      // Already exited.
    }
  } else {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      try {
        proc.kill("SIGTERM");
      } catch {
        // Already exited.
      }
    }
  }
}
