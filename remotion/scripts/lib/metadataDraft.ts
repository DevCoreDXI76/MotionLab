export interface MetadataDraftInput {
  title: string;
  format: "shorts" | "long";
  scenes: Array<{ narration: string; visual?: { source?: Record<string, unknown> | null } | null }>;
}

// YouTube's description limit is 5000 chars; 4900 leaves headroom rather than
// cutting exactly at the API's hard limit.
const DESCRIPTION_MAX_LEN = 4900;

/**
 * Credits and AI disclosure derived from each scene's `visual.source` (2기 episodes only —
 * 001~007 have no source, so their drafts are unchanged). Pexels clips are credited because we
 * told Pexels we would; AI images / reused Veo footage are disclosed in text and flagged as
 * synthetic media for the upload (docs/2단계_설계.md D6).
 */
export function describeVisualSources(scenes: MetadataDraftInput["scenes"]): { lines: string[]; synthetic: boolean } {
  const sources = scenes.map((s) => s.visual?.source).filter((s): s is Record<string, unknown> => !!s);
  const photographers = [...new Set(sources.filter((s) => s.provider === "pexels").map((s) => String(s.photographer)))];
  const aiImage = sources.some((s) => s.provider === "cloudflare-workers-ai");
  const aiClips = [...new Set(sources.filter((s) => s.provider === "existing-clip" && s.aiGenerator).map((s) => String(s.aiGenerator)))];
  const lines: string[] = [];
  if (aiImage) lines.push("일부 배경 이미지는 AI(FLUX.2 klein)로 생성했습니다.");
  for (const generator of aiClips) lines.push(`일부 영상 클립은 AI(${generator})로 생성했습니다.`);
  if (photographers.length > 0) lines.push(`B-roll 영상: Pexels — ${photographers.join(", ")}`);
  return { lines, synthetic: aiImage || aiClips.length > 0 };
}

export function generateMetadataDraft(script: MetadataDraftInput): string {
  const { lines, synthetic } = describeVisualSources(script.scenes);
  const extra = lines.length > 0 ? `\n\n${lines.join("\n")}` : "";
  const summary = script.scenes.map((s) => s.narration).join(" ").slice(0, DESCRIPTION_MAX_LEN - extra.length);
  const hashtags = script.format === "shorts" ? "#shorts #모션랩 #자동화영상" : "#모션랩 #자동화영상";
  const body = [`제목: ${script.title}`, "", `설명: ${summary}${extra}`, "", `해시태그: ${hashtags}`].join("\n");
  // Read by scripts/lib/metadata_parser.py → status.containsSyntheticMedia on upload. Placed first
  // because everything after "해시태그:" is parsed as tags.
  return synthetic ? `합성 콘텐츠: 예\n\n${body}` : body;
}
