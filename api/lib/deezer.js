import {
  normalizeSearchText,
  scoreTextAlignment,
  tokenize
} from "./music-contract.js";

const DEEZER_API_BASE_URL = "https://api.deezer.com";
const REQUEST_TIMEOUT_MS = 6_000;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 20;
const LOCAL_QUOTA_WINDOW_MS = 5_000;
const LOCAL_QUOTA_MAX_REQUESTS = 40;
const MIN_MATCH_SCORE = 72;

const requestTimestamps = [];

export function isDeezerMatchingEnabled() {
  return String(process.env.DEEZER_MATCHING_ENABLED || "true").toLowerCase() !== "false";
}

export function extractDeezerTrackId(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("deezer.com")) return "";

    const parts = parsed.pathname.split("/").filter(Boolean);
    const trackIndex = parts.findIndex(part => part.toLowerCase() === "track");
    const id = trackIndex !== -1 ? parts[trackIndex + 1] : "";
    return /^\d+$/.test(id) ? id : "";
  } catch (_error) {
    return "";
  }
}

export async function fetchDeezerTrackById(id) {
  if (!isDeezerMatchingEnabled()) return null;

  const trackId = extractDeezerTrackId(id);
  if (!trackId) return null;

  const payload = await fetchDeezerJson(`${DEEZER_API_BASE_URL}/track/${encodeURIComponent(trackId)}`);
  if (!payload || payload.error) return null;

  return normalizeDeezerTrack(payload);
}

export async function fetchDeezerTrackByIsrc(isrc) {
  if (!isDeezerMatchingEnabled()) return null;

  const normalizedIsrc = normalizeIsrc(isrc);
  if (!normalizedIsrc) return null;

  const payload = await fetchDeezerJson(`${DEEZER_API_BASE_URL}/track/isrc:${encodeURIComponent(normalizedIsrc)}`);
  if (!payload || payload.error) return null;

  return normalizeDeezerTrack(payload);
}

export async function searchDeezerTracks({ q, limit = DEFAULT_SEARCH_LIMIT, index = 0 } = {}) {
  if (!isDeezerMatchingEnabled()) {
    const error = new Error("deezer matching disabled");
    error.statusCode = 503;
    error.temporary = true;
    throw error;
  }

  const query = String(q || "").trim();
  if (!query) return { query: "", index: 0, limit: DEFAULT_SEARCH_LIMIT, total: 0, results: [] };

  const safeLimit = clampNumber(limit, 1, MAX_SEARCH_LIMIT, DEFAULT_SEARCH_LIMIT);
  const safeIndex = Math.max(0, Number.parseInt(index, 10) || 0);
  const url = new URL(`${DEEZER_API_BASE_URL}/search/track`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(safeLimit));
  url.searchParams.set("index", String(safeIndex));

  const payload = await fetchDeezerJson(url.toString());
  const results = (Array.isArray(payload?.data) ? payload.data : [])
    .map(normalizeDeezerTrack)
    .filter(item => item.id && item.url);

  return {
    query,
    index: safeIndex,
    limit: safeLimit,
    total: Number(payload?.total || results.length) || 0,
    results
  };
}

export async function findBestDeezerTrack(target = {}) {
  if (!isDeezerMatchingEnabled()) return null;

  const title = String(target.title || target.trackName || "").trim();
  const artist = String(target.artist || target.artistName || target.description || "").trim();
  const query = String(target.query || [title, artist].filter(Boolean).join(" ")).trim();
  const isrc = normalizeIsrc(target.isrc);
  const duration = Number(target.duration || target.durationSeconds || 0) || Math.round((Number(target.durationMs || 0) || 0) / 1000);

  if (isrc) {
    try {
      const isrcMatch = await fetchDeezerTrackByIsrc(isrc);
      if (isrcMatch) {
        const score = scoreDeezerCandidate({ title, artist, query, isrc, duration }, isrcMatch);
        if (score >= MIN_MATCH_SCORE || normalizeIsrc(isrcMatch.isrc) === isrc) {
          return {
            ...isrcMatch,
            isVerified: true,
            score: Math.max(score, 95)
          };
        }
      }
    } catch (_error) {
      // ISRC lookup is opportunistic; text search still gives us a conservative path.
    }
  }

  if (!query) return null;

  const search = await searchDeezerTracks({ q: query, limit: 8, index: 0 });
  let best = null;
  let bestScore = -1;

  for (const candidate of search.results) {
    const score = scoreDeezerCandidate({ title, artist, query, isrc, duration }, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || bestScore < MIN_MATCH_SCORE) return null;

  return {
    ...best,
    isVerified: bestScore >= MIN_MATCH_SCORE,
    score: bestScore
  };
}

export function normalizeDeezerTrack(track = {}) {
  const id = String(track.id || "").trim();
  const artist = track.artist || {};
  const album = track.album || {};
  const url = canonicalDeezerTrackUrl(track.link || id);

  return {
    type: "deezer",
    id,
    title: String(track.title_short || track.title || "").trim(),
    artist: String(artist.name || "").trim(),
    album: String(album.title || "").trim(),
    duration: Number(track.duration || 0) || 0,
    isrc: normalizeIsrc(track.isrc),
    image: String(album.cover_xl || album.cover_big || album.cover_medium || album.cover || "").trim(),
    url,
    readable: Boolean(track.readable),
    rank: Number(track.rank || 0) || 0,
    source: "deezer_api"
  };
}

export function scoreDeezerCandidate(target = {}, candidate = {}) {
  let score = scoreTextAlignment(
    {
      title: target.title || target.query || "",
      artist: target.artist || ""
    },
    {
      title: candidate.title || "",
      artist: candidate.artist || "",
      description: candidate.album || ""
    }
  );

  const targetTitle = normalizeSearchText(target.title || "");
  const candidateTitle = normalizeSearchText(candidate.title || "");
  const targetArtist = normalizeSearchText(target.artist || "");
  const candidateArtist = normalizeSearchText(candidate.artist || "");

  if (targetTitle && candidateTitle === targetTitle) score += 28;
  else if (targetTitle && candidateTitle.startsWith(targetTitle)) score += 8;

  if (targetArtist && candidateArtist === targetArtist) score += 24;

  const targetIsrc = normalizeIsrc(target.isrc);
  const candidateIsrc = normalizeIsrc(candidate.isrc);
  if (targetIsrc && candidateIsrc && targetIsrc === candidateIsrc) score += 60;

  const targetDuration = Number(target.duration || 0) || 0;
  const candidateDuration = Number(candidate.duration || 0) || 0;
  if (targetDuration && candidateDuration) {
    const diff = Math.abs(targetDuration - candidateDuration);
    if (diff <= 2) score += 12;
    else if (diff <= 5) score += 6;
    else if (diff > 12) score -= 14;
  }

  const targetTokens = new Set(tokenize(target.title || target.query || ""));
  const candidateTokens = new Set(tokenize(candidate.title || ""));
  for (const qualifier of ["live", "acoustic", "remix", "instrumental", "karaoke", "sped", "slowed"]) {
    if (!targetTokens.has(qualifier) && candidateTokens.has(qualifier)) score -= 10;
    if (targetTokens.has(qualifier) && !candidateTokens.has(qualifier)) score -= 4;
  }

  if (candidate.readable) score += 4;
  if (candidate.rank >= 500_000) score += 4;
  else if (candidate.rank >= 100_000) score += 2;

  return Math.max(0, Math.min(150, score));
}

function canonicalDeezerTrackUrl(value) {
  const id = extractDeezerTrackId(value);
  return id ? `https://www.deezer.com/track/${id}` : "";
}

function normalizeIsrc(value) {
  return String(value || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

async function fetchDeezerJson(url) {
  acquireLocalQuota();

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "music-link-swapper/1.0"
    }
  });
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(`deezer api failed: ${response.status}`);
    error.statusCode = response.status;
    error.temporary = response.status === 429 || response.status >= 500;
    throw error;
  }

  if (payload?.error) {
    const error = buildDeezerPayloadError(payload.error);
    if (error.notFound) return null;
    throw error;
  }

  return payload;
}

function buildDeezerPayloadError(payloadError) {
  const code = Number(payloadError?.code || 0) || 0;
  const message = String(payloadError?.message || payloadError?.type || "deezer api error");
  const error = new Error(message);
  error.code = code;
  error.statusCode = code === 800 ? 404 : code === 4 || code === 700 ? 503 : 502;
  error.notFound = code === 800;
  error.temporary = code === 4 || code === 700;
  return error;
}

function acquireLocalQuota() {
  const now = Date.now();
  while (requestTimestamps.length && requestTimestamps[0] <= now - LOCAL_QUOTA_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= LOCAL_QUOTA_MAX_REQUESTS) {
    const error = new Error("deezer local quota exceeded");
    error.statusCode = 503;
    error.temporary = true;
    throw error;
  }

  requestTimestamps.push(now);
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
