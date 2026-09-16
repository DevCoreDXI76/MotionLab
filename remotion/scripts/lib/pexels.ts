export interface PexelsVideoFile {
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

export interface PexelsVideoResult {
  id: number;
  width: number;
  height: number;
  url: string; // Pexels page URL — kept for attribution.
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

export interface PexelsSearchResponse {
  videos: PexelsVideoResult[];
}

const QUALITY_PREFERENCE = ["hd", "sd"]; // avoid the largest ("uhd") renditions — b-roll doesn't need 4K.

// Pexels' "hd" tag doesn't guarantee a usable resolution — some clips are tagged hd but were
// uploaded at e.g. 360x640, too soft for a full-screen background. 720x1280 was confirmed usable
// in practice (004/005/006 logs); 360x640 was rejected every time. See docs/remotion_사이드트랙_프로젝트설정.md.
const MIN_PORTRAIT_HEIGHT = 1280;

// 005 policy (docs/remotion_사이드트랙_프로젝트설정.md): emotional-beat b-roll defaults to
// hand/screen closeups, not faces (004 review found face closeups caused person-to-person
// discontinuity across scenes). Pexels doesn't expose a reliable "shot composition" field, so
// this checks the page URL slug — the only text Pexels guarantees per video (`tags` exists in
// the API but is commonly empty). Heuristic, not a real vision check: catches the common case
// where the uploader's own title says "face"/"portrait", not every face closeup.
const FACE_CLOSEUP_KEYWORDS = ["face", "portrait", "headshot", "selfie", "smiling"];

function isFaceCloseup(pageUrl: string): boolean {
  const slug = pageUrl.toLowerCase();
  return FACE_CLOSEUP_KEYWORDS.some((keyword) => slug.includes(keyword));
}

/**
 * Searches Pexels' free stock video API for a portrait clip matching `query`
 * and returns the best-matching downloadable mp4 file plus attribution info
 * (Pexels' license doesn't require attribution, but crediting the
 * photographer in the video description is good practice and what we told
 * Pexels we'd do when requesting the API key).
 */
export async function searchPortraitVideo(
  query: string,
  apiKey: string,
  excludeIds: Set<number> = new Set(),
  allowFaceCloseup = false,
): Promise<{ id: number; downloadUrl: string; width: number; height: number; photographer: string; pageUrl: string } | null> {
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("per_page", "5");

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    throw new Error(`Pexels API error ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as PexelsSearchResponse;

  for (const video of data.videos) {
    if (excludeIds.has(video.id)) continue;
    if (!allowFaceCloseup && isFaceCloseup(video.url)) continue;
    const file = pickBestFile(video.video_files);
    if (file) {
      return {
        id: video.id,
        downloadUrl: file.link,
        width: file.width,
        height: file.height,
        photographer: video.user.name,
        pageUrl: video.url,
      };
    }
  }
  return null;
}

/** Exported for testing; also used directly by searchPortraitVideo. */
export function pickBestFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  const portraitMp4 = files.filter(
    (f) => f.file_type === "video/mp4" && f.height >= f.width && f.height >= MIN_PORTRAIT_HEIGHT,
  );
  for (const quality of QUALITY_PREFERENCE) {
    const match = portraitMp4.find((f) => f.quality === quality);
    if (match) return match;
  }
  return portraitMp4[0];
}
