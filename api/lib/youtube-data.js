import {
  buildYoutubePlatformLinks,
  normalizeSearchText,
  scoreTextAlignment,
  tokenize
} from "./music-contract.js";

const YOUTUBE_SEARCH_API_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_API_URL = "https://www.googleapis.com/youtube/v3/videos";
const REQUEST_TIMEOUT_MS = 10_000;
const MUSIC_CATEGORY_ID = "10";
const STRICT_MIN_ACCEPTED_SCORE = 72;
const BROAD_MIN_ACCEPTED_SCORE = 84;
const BROAD_MAX_DURATION_DIFF_MS = 12_000;

export function isYoutubeDataMatchingConfigured() {
  return (
    process.env.YOUTUBE_MATCHING_ENABLED !== "false" &&
    Boolean(String(process.env.YOUTUBE_API_KEY || "").trim())
  );
}

export async function searchYoutubeVideoForTrack(query, target = {}) {
  const result = await searchYoutubeVideoForTrackWithDiagnostics(query, target);
  return result?.match || null;
}

export async function searchYoutubeVideoForTrackWithDiagnostics(query, target = {}) {
  if (!isYoutubeDataMatchingConfigured()) return null;

  const apiKey = getYoutubeApiKey();
  const diagnostics = {};

  const strict = await runYoutubeSearchPass(apiKey, query, target, {
    pass: "strict",
    maxResults: 5,
    includeMusicCategory: true,
    includeOfficialAudioSuffix: true,
    minAcceptedScore: STRICT_MIN_ACCEPTED_SCORE
  });
  diagnostics.strict = strict.diagnostics;
  diagnostics.lastPass = "strict";
  if (strict.match) {
    return { match: strict.match, diagnostics };
  }

  const broad = await runYoutubeSearchPass(apiKey, query, target, {
    pass: "broad",
    maxResults: 10,
    includeMusicCategory: false,
    includeOfficialAudioSuffix: false,
    minAcceptedScore: BROAD_MIN_ACCEPTED_SCORE,
    maxDurationDiffMs: BROAD_MAX_DURATION_DIFF_MS
  });
  diagnostics.broad = broad.diagnostics;
  diagnostics.lastPass = "broad";

  return {
    match: broad.match,
    diagnostics
  };
}

function getYoutubeApiKey() {
  return String(process.env.YOUTUBE_API_KEY || "").trim();
}

async function runYoutubeSearchPass(apiKey, query, target, options) {
  const searchTerm = buildYoutubeSearchTerm(query, target, options);
  if (!searchTerm) {
    return {
      match: null,
      diagnostics: {
        pass: options.pass,
        searchTerm: "",
        candidateCount: 0,
        bestScore: 0
      }
    };
  }

  const searchUrl = new URL(YOUTUBE_SEARCH_API_URL);
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(options.maxResults));
  if (options.includeMusicCategory) {
    searchUrl.searchParams.set("videoCategoryId", MUSIC_CATEGORY_ID);
  }
  searchUrl.searchParams.set("q", searchTerm);

  const searchResponse = await fetchWithTimeout(searchUrl.toString());
  if (!searchResponse.ok) {
    throw new Error(`youtube search failed: ${searchResponse.status}`);
  }

  const searchPayload = await searchResponse.json();
  const searchItems = Array.isArray(searchPayload?.items) ? searchPayload.items : [];
  const videoIds = searchItems
    .map(item => item?.id?.videoId)
    .filter(Boolean)
    .slice(0, options.maxResults);

  if (!videoIds.length) {
    return {
      match: null,
      diagnostics: {
        pass: options.pass,
        searchTerm,
        candidateCount: 0,
        bestScore: 0
      }
    };
  }

  const details = await fetchYoutubeVideoDetails(videoIds, apiKey);
  const detailById = new Map(details.map(item => [item.id, item]));
  const scored = searchItems
    .map((item, index) => buildYoutubeCandidate(item, detailById.get(item?.id?.videoId), index))
    .filter(candidate => candidate.videoId)
    .map(candidate => ({
      ...candidate,
      score: scoreYoutubeCandidate(target, candidate)
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0] || null;
  const accepted = scored.find(candidate => (
    candidate.score >= options.minAcceptedScore &&
    isDurationAcceptableForPass(target, candidate, options)
  ));

  return {
    match: accepted ? buildYoutubeMatch(accepted, options.pass) : null,
    diagnostics: {
      pass: options.pass,
      searchTerm,
      candidateCount: scored.length,
      bestScore: best?.score || 0
    }
  };
}

function buildYoutubeMatch(candidate, pass) {
  return {
    type: "youtube",
    videoId: candidate.videoId,
    url: `https://www.youtube.com/watch?v=${candidate.videoId}`,
    isVerified: candidate.score >= 84,
    source: "youtube_api",
    title: candidate.title,
    channelTitle: candidate.channelTitle,
    durationMs: candidate.durationMs,
    score: candidate.score,
    pass,
    links: buildYoutubePlatformLinks(candidate.videoId, {
      source: "youtube_api",
      isVerified: candidate.score >= 84
    })
  };
}

function isDurationAcceptableForPass(target, candidate, options) {
  const maxDiff = Number(options?.maxDurationDiffMs || 0) || 0;
  if (!maxDiff) return true;

  const targetDurationMs = Number(target?.durationMs || target?.duration || 0) || 0;
  const candidateDurationMs = Number(candidate?.durationMs || 0) || 0;
  if (!targetDurationMs || !candidateDurationMs) return true;

  return Math.abs(targetDurationMs - candidateDurationMs) <= maxDiff;
}

export function scoreYoutubeCandidate(target, candidate) {
  const title = String(target?.title || "").trim();
  const artist = String(target?.artist || target?.description || "").trim();
  const targetText = normalizeSearchText([title, artist].filter(Boolean).join(" "));
  const candidateText = normalizeSearchText([
    candidate?.title,
    candidate?.channelTitle,
    candidate?.description
  ].filter(Boolean).join(" "));

  if (!targetText || !candidateText) return 0;

  let score = scoreTextAlignment(
    { title, artist },
    {
      title: candidate?.title || "",
      artist: candidate?.channelTitle || "",
      description: candidate?.description || ""
    }
  );

  if (String(candidate?.categoryId || "") === MUSIC_CATEGORY_ID) score += 10;

  const titleTokens = tokenize(title);
  const artistTokens = tokenize(artist);
  score += scoreTokenCoverage(titleTokens, candidateText, 18, 8);
  score += scoreTokenCoverage(artistTokens, candidateText, 14, 6);

  const normalizedTitle = normalizeSearchText(candidate?.title || "");
  const normalizedChannel = normalizeSearchText(candidate?.channelTitle || "");
  const normalizedDescription = normalizeSearchText(candidate?.description || "");
  const allText = [normalizedTitle, normalizedChannel, normalizedDescription].join(" ");

  if (hasAny(allText, ["official audio", "provided to youtube", "auto generated by youtube", "art track"])) score += 14;
  if (hasAny(allText, ["official music video", "official video", "vevo"])) score += 8;
  if (hasAny(normalizedChannel, ["topic", "vevo", "official"])) score += 8;
  if (candidate?.licensedContent) score += 5;
  if (candidate?.position === 0) score += 4;

  const unwanted = ["cover", "karaoke", "reaction", "tutorial", "instrumental", "sped up", "slowed"];
  for (const word of unwanted) {
    if (allText.includes(word) && !targetText.includes(word)) score -= 14;
  }
  if (allText.includes("live") && !targetText.includes("live")) score -= 8;
  if (candidate?.liveBroadcastContent && candidate.liveBroadcastContent !== "none") score -= 25;

  const targetDurationMs = Number(target?.durationMs || target?.duration || 0) || 0;
  const candidateDurationMs = Number(candidate?.durationMs || 0) || 0;
  if (targetDurationMs > 0 && candidateDurationMs > 0) {
    const diff = Math.abs(targetDurationMs - candidateDurationMs);
    if (diff <= 2_500) score += 16;
    else if (diff <= 6_000) score += 8;
    else if (diff > 12_000) score -= 18;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildYoutubeSearchTerm(query, target, options = {}) {
  const title = String(target?.title || "").trim();
  const artist = String(target?.artist || target?.description || "").trim();
  const fallback = String(query || "").trim();
  const base = [artist, title].filter(Boolean).join(" ").trim() || fallback;
  if (!base) return "";
  return options.includeOfficialAudioSuffix ? `${base} official audio` : base;
}

async function fetchYoutubeVideoDetails(videoIds, apiKey) {
  const url = new URL(YOUTUBE_VIDEOS_API_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,contentDetails,status");
  url.searchParams.set("id", videoIds.join(","));

  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) {
    throw new Error(`youtube videos failed: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

function buildYoutubeCandidate(searchItem, detail, position) {
  const snippet = detail?.snippet || searchItem?.snippet || {};
  return {
    videoId: searchItem?.id?.videoId || detail?.id || "",
    title: String(snippet?.title || "").trim(),
    description: String(snippet?.description || "").trim(),
    channelTitle: String(snippet?.channelTitle || "").trim(),
    categoryId: String(snippet?.categoryId || ""),
    durationMs: parseYoutubeDurationMs(detail?.contentDetails?.duration || ""),
    licensedContent: Boolean(detail?.contentDetails?.licensedContent),
    liveBroadcastContent: String(snippet?.liveBroadcastContent || "none"),
    position
  };
}

function scoreTokenCoverage(tokens, candidateText, fullPoints, partialPoints) {
  if (!tokens.length) return 0;
  const matches = tokens.filter(token => candidateText.includes(token)).length;
  const ratio = matches / tokens.length;
  if (ratio >= 0.85) return fullPoints;
  if (ratio >= 0.5) return partialPoints;
  return -partialPoints;
}

function hasAny(text, needles) {
  return needles.some(needle => text.includes(needle));
}

function parseYoutubeDurationMs(duration) {
  const match = String(duration || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = Number(match[1] || 0) || 0;
  const minutes = Number(match[2] || 0) || 0;
  const seconds = Number(match[3] || 0) || 0;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
