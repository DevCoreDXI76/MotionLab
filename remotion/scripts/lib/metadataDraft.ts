export interface MetadataDraftInput {
  title: string;
  format: "shorts" | "long";
  scenes: Array<{ narration: string }>;
}

// YouTube's description limit is 5000 chars; 4900 leaves headroom rather than
// cutting exactly at the API's hard limit.
const DESCRIPTION_MAX_LEN = 4900;

export function generateMetadataDraft(script: MetadataDraftInput): string {
  const summary = script.scenes.map((s) => s.narration).join(" ").slice(0, DESCRIPTION_MAX_LEN);
  const hashtags = script.format === "shorts" ? "#shorts #모션랩 #자동화영상" : "#모션랩 #자동화영상";
  return [`제목: ${script.title}`, "", `설명: ${summary}`, "", `해시태그: ${hashtags}`].join("\n");
}
