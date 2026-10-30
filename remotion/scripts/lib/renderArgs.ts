/**
 * `npx remotion render` arguments for an episode. Episodes with a 3D diagram scene get
 * `--gl=angle` (GPU via D3D11 — without it Chromium falls back to SwiftShader, ~1.7x slower; 008
 * spike experiment C). 2D-only episodes keep the default backend so 001~007 render exactly as
 * before (docs/2단계_설계.md D3).
 */
export function buildRenderArgs(
  script: { scenes: Array<{ type: string }> },
  scriptPath: string,
  outputPath: string,
): string[] {
  const args = ["remotion", "render", "src/index.ts", "Episode", outputPath, `--props=${scriptPath}`];
  if (script.scenes.some((s) => s.type === "diagram")) {
    args.push("--gl=angle");
  }
  return args;
}
