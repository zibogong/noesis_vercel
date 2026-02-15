import type { TranscriptSnippet, LanguageInfo } from "./types";

const INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const INNERTUBE_CLIENT_VERSION = "19.09.37";

const WEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function extractVideoId(urlOrId: string): string {
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return urlOrId;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name?: { simpleText?: string };
  kind?: string;
}

interface InnertubePlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
      translationLanguages?: unknown[];
    };
  };
  playabilityStatus?: {
    status?: string;
  };
}

async function fetchInnertubePlayer(
  videoId: string
): Promise<InnertubePlayerResponse> {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: INNERTUBE_CLIENT_VERSION,
            androidSdkVersion: 30,
            hl: "en",
          },
        },
        videoId,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`YouTube innertube API error: ${res.status}`);
  }

  return res.json();
}

function getCaptionTracks(player: InnertubePlayerResponse): CaptionTrack[] {
  return player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n/g, " ");
}

function parseFormat3Xml(xml: string): TranscriptSnippet[] {
  const snippets: TranscriptSnippet[] = [];
  const pRegex = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;

  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durationMs = parseInt(match[2], 10);
    const innerHtml = match[3];

    // Extract text from <s> tags within <p>, or use raw content
    const words: string[] = [];
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    while ((sMatch = sRegex.exec(innerHtml)) !== null) {
      words.push(sMatch[1]);
    }

    const text =
      words.length > 0
        ? decodeHtmlEntities(words.join("").trim())
        : decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, "").trim());

    if (text) {
      snippets.push({
        text,
        start: startMs / 1000,
        duration: durationMs / 1000,
      });
    }
  }

  return snippets;
}

function parseLegacyXml(xml: string): TranscriptSnippet[] {
  const snippets: TranscriptSnippet[] = [];
  const regex =
    /<text start="([^"]*)" dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    snippets.push({
      text: decodeHtmlEntities(match[3]),
      start: parseFloat(match[1]),
      duration: parseFloat(match[2]),
    });
  }

  return snippets;
}

export async function fetchTranscript(
  videoId: string,
  lang?: string
): Promise<TranscriptSnippet[]> {
  const player = await fetchInnertubePlayer(videoId);

  if (player.playabilityStatus?.status === "ERROR") {
    throw new Error(
      `Video is unavailable: ${videoId}. The video may be private, deleted, or not exist.`
    );
  }

  let tracks = getCaptionTracks(player);
  console.log(`[transcript:${videoId}] InnerTube ANDROID returned ${tracks.length} tracks`);

  // Fallback to web scraping if ANDROID client returns no tracks
  // (YouTube may block InnerTube ANDROID API from cloud provider IPs)
  if (tracks.length === 0) {
    console.log(`[transcript:${videoId}] Falling back to web scraping...`);
    const webPlayer = await fetchWebPlayerResponse(videoId);
    tracks =
      webPlayer?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    console.log(`[transcript:${videoId}] Web scraping returned ${tracks.length} tracks`);
  }

  if (tracks.length === 0) {
    throw new Error(`No transcript found for video: ${videoId}`);
  }

  const targetLang = lang || "en";
  const track =
    tracks.find((t) => t.languageCode === targetLang) || tracks[0];

  const res = await fetch(track.baseUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch captions: ${res.status}`);
  }

  const xml = await res.text();
  if (!xml) {
    throw new Error(`Empty caption response for video: ${videoId}`);
  }

  // Detect format: format 3 uses <p> tags, legacy uses <text> tags
  if (xml.includes('format="3"') || xml.includes("<p t=")) {
    return parseFormat3Xml(xml);
  }
  return parseLegacyXml(xml);
}

export function transcriptToText(
  transcript: TranscriptSnippet[],
  separator = " "
): string {
  return transcript.map((s) => s.text).join(separator);
}

function parsePlayerResponseFromHtml(html: string) {
  const playerMatch = html.match(
    /ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s|<\/script>)/
  );
  if (!playerMatch) {
    throw new Error("Could not find player response data");
  }
  return JSON.parse(playerMatch[1]);
}

async function fetchWebPlayerResponse(videoId: string) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  // Try direct fetch first
  console.log(`[webPlayer:${videoId}] Trying direct web scrape...`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": WEB_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (res.ok) {
    const html = await res.text();
    try {
      const player = parsePlayerResponseFromHtml(html);
      const tracks =
        player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      console.log(`[webPlayer:${videoId}] Direct scrape found ${tracks.length} tracks`);
      if (tracks.length > 0) return player;
    } catch (e) {
      console.log(`[webPlayer:${videoId}] Direct scrape parse failed: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    console.log(`[webPlayer:${videoId}] Direct scrape HTTP ${res.status}`);
  }

  // Fallback: route through ScraperAPI for residential IP
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  if (!scraperApiKey) {
    console.error(`[webPlayer:${videoId}] SCRAPER_API_KEY not configured`);
    throw new Error("No captions found and SCRAPER_API_KEY is not configured");
  }

  console.log(`[webPlayer:${videoId}] Trying ScraperAPI fallback...`);
  const proxyUrl = `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`;
  const proxyRes = await fetch(proxyUrl);
  if (!proxyRes.ok) {
    console.error(`[webPlayer:${videoId}] ScraperAPI failed: HTTP ${proxyRes.status}`);
    throw new Error(`ScraperAPI request failed: ${proxyRes.status}`);
  }

  const proxyHtml = await proxyRes.text();
  console.log(`[webPlayer:${videoId}] ScraperAPI returned ${proxyHtml.length} chars`);
  return parsePlayerResponseFromHtml(proxyHtml);
}

export async function listAvailableLanguages(
  videoId: string
): Promise<LanguageInfo[]> {
  // Try innertube ANDROID first, fall back to web scraping
  let tracks: CaptionTrack[];
  let translationLanguages: unknown[] | undefined;

  const player = await fetchInnertubePlayer(videoId);
  tracks = getCaptionTracks(player);
  translationLanguages =
    player.captions?.playerCaptionsTracklistRenderer?.translationLanguages;

  if (tracks.length === 0) {
    // Fallback to web scraping
    const webPlayer = await fetchWebPlayerResponse(videoId);
    const webCaptions = webPlayer?.captions?.playerCaptionsTracklistRenderer;
    tracks = webCaptions?.captionTracks ?? [];
    translationLanguages = webCaptions?.translationLanguages;
  }

  if (tracks.length === 0) {
    return [];
  }

  const hasTranslation =
    Array.isArray(translationLanguages) && translationLanguages.length > 0;

  return tracks.map((track) => ({
    language_code: track.languageCode,
    language: track.name?.simpleText || track.languageCode,
    is_generated: track.kind === "asr",
    is_translatable: hasTranslation,
  }));
}
