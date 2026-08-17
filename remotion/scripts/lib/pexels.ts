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
): Promise<{ downloadUrl: string; width: number; height: number; photographer: string; pageUrl: string } | null> {
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
    const file = pickBestFile(video.video_files);
    if (file) {
      return {
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

function pickBestFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  const portraitMp4 = files.filter((f) => f.file_type === "video/mp4" && f.height >= f.width);
  for (const quality of QUALITY_PREFERENCE) {
    const match = portraitMp4.find((f) => f.quality === quality);
    if (match) return match;
  }
  return portraitMp4[0];
}
