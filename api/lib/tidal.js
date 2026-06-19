import {
  getPrimaryArtistCredit,
  isArtistCreditMatch,
  normalizeSearchText,
  scoreTextAlignment,
  tokenize
} from "./music-contract.js";

const TIDAL_API_BASE_URL = "https://openapi.tidal.com/v2";
const TIDAL_TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
const REQUEST_TIMEOUT_MS = 6_000;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 20;
const LOCAL_QUOTA_WINDOW_MS = 5_000;
const LOCAL_QUOTA_MAX_REQUESTS = 30;
const MIN_MATCH_SCORE = 72;
const TOKEN_EXPIRY_SKEW_MS = 60_000;

const requestTimestamps = [];
let tokenCache = {
  accessToken: "",
  expiresAt: 0
};

export function isTidalMatchingEnabled() {
  return String(process.env.TIDAL_MATCHING_ENABLED || "true").toLowerCase() !== "false";
}

export function isTidalConfigured() {
  return Boolean(String(process.env.TIDAL_CLIENT_ID || "").trim() && String(process.env.TIDAL_CLIENT_SECRET || "").trim());
}

export function getTidalCountryCode() {
  const countryCode = String(process.env.TIDAL_COUNTRY_CODE || "BR").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(countryCode) ? countryCode : "BR";
}

export function extractTidalTrackId(value) {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host !== "tidal.com" && !host.endsWith(".tidal.com")) return "";

    const parts = parsed.pathname.split("/").filter(Boolean).map(part => part.toLowerCase());
    let id = "";
    if (parts[0] === "browse" && parts[1] === "track") id = parts[2] || "";
    else if (parts[0] === "track") id = parts[1] || "";

    return /^\d+$/.test(id) ? id : "";
  } catch (_error) {
    return "";
  }
}

export function canonicalTidalTrackUrl(value) {
  const id = extractTidalTrackId(value);
  return id ? `https://tidal.com/browse/track/${id}` : "";
}

export async function fetchTidalTrackById(id) {
  if (!isTidalMatchingEnabled()) return null;

  const trackId = extractTidalTrackId(id);
  if (!trackId) return null;

  try {
    const url = new URL(`${TIDAL_API_BASE_URL}/tracks/${encodeURIComponent(trackId)}`);
    url.searchParams.set("countryCode", getTidalCountryCode());
    url.searchParams.set("include", "albums,artists");

    const payload = await fetchTidalJson(url.toString());
    return normalizeTidalTrack(payload?.data, payload?.included || []);
  } catch (error) {
    if (error?.notFound) return null;
    throw error;
  }
}

export async function fetchTidalTracksByIsrc(isrc) {
  if (!isTidalMatchingEnabled()) return [];

  const normalizedIsrc = normalizeIsrc(isrc);
  if (!normalizedIsrc) return [];

  try {
    const url = new URL(`${TIDAL_API_BASE_URL}/tracks`);
    url.searchParams.set("countryCode", getTidalCountryCode());
    url.searchParams.set("include", "albums,artists");
    url.searchParams.set("filter[isrc]", normalizedIsrc);

    const payload = await fetchTidalJson(url.toString());
    return normalizeTidalTrackList(payload);
  } catch (error) {
    if (error?.notFound) return [];
    throw error;
  }
}

export async function searchTidalTracks({ q, limit = DEFAULT_SEARCH_LIMIT, cursor = "" } = {}) {
  if (!isTidalMatchingEnabled()) {
    const error = new Error("tidal matching disabled");
    error.statusCode = 503;
    error.temporary = true;
    throw error;
  }

  const query = String(q || "").trim();
  const safeLimit = clampNumber(limit, 1, MAX_SEARCH_LIMIT, DEFAULT_SEARCH_LIMIT);
  const safeCursor = String(cursor || "").trim();
  if (!query) {
    return {
      query: "",
      countryCode: getTidalCountryCode(),
      limit: safeLimit,
      cursor: safeCursor,
      nextCursor: "",
      results: []
    };
  }

  const url = new URL(`${TIDAL_API_BASE_URL}/searchResults/${encodeURIComponent(query)}/relationships/tracks`);
  url.searchParams.set("countryCode", getTidalCountryCode());
  url.searchParams.set("include", "tracks");
  if (safeCursor) url.searchParams.set("page[cursor]", safeCursor);

  const payload = await fetchTidalJson(url.toString());
  const includedTracks = normalizeTidalTrackList({ data: payload?.included || [], included: payload?.included || [] });
  const includedById = new Map(includedTracks.map(track => [track.id, track]));
  const relationshipIds = (Array.isArray(payload?.data) ? payload.data : [])
    .map(item => String(item?.id || "").trim())
    .filter(Boolean);

  const results = [];
  for (const id of relationshipIds) {
    const included = includedById.get(id);
    const hydrated = await fetchTidalTrackById(id).catch(() => null);
    if (hydrated?.url) results.push(hydrated);
    else if (included?.url) results.push(included);
    if (results.length >= safeLimit) break;
  }

  if (!results.length && includedTracks.length) {
    results.push(...includedTracks.slice(0, safeLimit));
  }

  return {
    query,
    countryCode: getTidalCountryCode(),
    limit: safeLimit,
    cursor: safeCursor,
    nextCursor: extractCursorFromLink(payload?.links?.next || ""),
    results: results.slice(0, safeLimit)
  };
}

export async function findBestTidalTrack(target = {}) {
  if (!isTidalMatchingEnabled() || !isTidalConfigured()) return null;

  const title = String(target.title || target.trackName || "").trim();
  const artist = String(target.artist || target.artistName || target.description || "").trim();
  const album = String(target.album || target.albumName || "").trim();
  const query = String(target.query || [title, artist].filter(Boolean).join(" ")).trim();
  const isrc = normalizeIsrc(target.isrc);
  const duration = Number(target.duration || target.durationSeconds || 0) || Math.round((Number(target.durationMs || 0) || 0) / 1000);

  if (isrc) {
    try {
      const isrcMatches = await fetchTidalTracksByIsrc(isrc);
      const bestIsrcMatch = pickBestTidalCandidate({ title, artist, album, query, isrc, duration }, isrcMatches);
      if (bestIsrcMatch && (bestIsrcMatch.score >= MIN_MATCH_SCORE || normalizeIsrc(bestIsrcMatch.isrc) === isrc)) {
        return {
          ...bestIsrcMatch,
          isVerified: true,
          score: Math.max(bestIsrcMatch.score, 95)
        };
      }
    } catch (_error) {
      // ISRC lookup is opportunistic; text search still gives us a conservative path.
    }
  }

  if (!query) return null;

  let best = null;
  for (const searchQuery of buildSearchQueries({ query, title, artist })) {
    const search = await searchTidalTracks({ q: searchQuery, limit: 8 });
    const candidate = pickBestTidalCandidate({ title, artist, album, query, isrc, duration }, search.results);
    if (!best || Number(candidate?.score || 0) > Number(best?.score || 0)) {
      best = candidate;
    }
  }
  if (!best || best.score < MIN_MATCH_SCORE) return null;

  return {
    ...best,
    isVerified: true
  };
}

export function normalizeTidalTrack(track = {}, included = []) {
  const id = String(track?.id || "").trim();
  if (!id) return null;

  const attributes = track?.attributes || {};
  const includedByKey = buildIncludedMap(included);
  const artist = getRelationshipAttribute(track, includedByKey, "artists", "name");
  const album = getRelationshipAttribute(track, includedByKey, "albums", "title");
  const version = String(attributes.version || "").trim();
  const title = [attributes.title, version].filter(Boolean).join(" - ").trim();

  return {
    type: "tidal",
    id,
    title,
    artist,
    album,
    duration: parseIsoDurationSeconds(attributes.duration),
    isrc: normalizeIsrc(attributes.isrc),
    url: canonicalTidalTrackUrl(id),
    explicit: Boolean(attributes.explicit),
    popularity: Number(attributes.popularity || 0) || 0,
    source: "tidal_api"
  };
}

export function scoreTidalCandidate(target = {}, candidate = {}) {
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
  const targetAlbum = normalizeSearchText(target.album || "");
  const candidateAlbum = normalizeSearchText(candidate.album || "");

  if (targetTitle && candidateTitle === targetTitle) score += 28;
  else if (targetTitle && candidateTitle.startsWith(targetTitle)) score += 8;

  if (targetArtist && candidateArtist === targetArtist) score += 24;
  else if (isArtistCreditMatch(target.artist, candidate.artist)) score += 22;
  if (targetAlbum && candidateAlbum === targetAlbum) score += 12;
  else if (targetAlbum && candidateAlbum && candidateAlbum.includes(targetAlbum)) score += 6;

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

  if (candidate.popularity >= 0.75) score += 4;
  else if (candidate.popularity >= 0.45) score += 2;

  return Math.max(0, Math.min(150, score));
}

export function __resetTidalTokenCacheForTests() {
  tokenCache = {
    accessToken: "",
    expiresAt: 0
  };
  requestTimestamps.splice(0, requestTimestamps.length);
}

function normalizeTidalTrackList(payload = {}) {
  const included = Array.isArray(payload?.included) ? payload.included : [];
  return (Array.isArray(payload?.data) ? payload.data : [])
    .map(item => normalizeTidalTrack(item, included))
    .filter(item => item?.id && item?.url);
}

function pickBestTidalCandidate(target, candidates = []) {
  let best = null;
  let bestScore = -1;

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const score = scoreTidalCandidate(target, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best ? { ...best, score: bestScore } : null;
}

function buildIncludedMap(included = []) {
  const map = new Map();
  for (const item of Array.isArray(included) ? included : []) {
    const type = String(item?.type || "").toLowerCase();
    const id = String(item?.id || "");
    if (type && id) map.set(`${type}:${id}`, item);
  }
  return map;
}

function getRelationshipAttribute(track, includedByKey, relationshipName, attributeName) {
  const data = track?.relationships?.[relationshipName]?.data;
  const relationship = Array.isArray(data) ? data[0] : data;
  const type = String(relationship?.type || relationshipName).toLowerCase();
  const id = String(relationship?.id || "");
  if (!id) return "";
  const resource = includedByKey.get(`${type}:${id}`) || includedByKey.get(`${relationshipName}:${id}`);
  return String(resource?.attributes?.[attributeName] || "").trim();
}

function parseIsoDurationSeconds(value) {
  if (typeof value === "number") return Math.round(value);
  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw) || 0;

  const match = raw.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!match) return 0;

  const hours = Number(match[1] || 0) || 0;
  const minutes = Number(match[2] || 0) || 0;
  const seconds = Number(match[3] || 0) || 0;
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

function normalizeIsrc(value) {
  return String(value || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function buildSearchQueries({ query, title, artist }) {
  const primaryArtist = getPrimaryArtistCredit(artist);
  const values = [
    query,
    [title, primaryArtist].filter(Boolean).join(" ")
  ];
  const seen = new Set();
  return values.filter(value => {
    const normalized = normalizeSearchText(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function extractCursorFromLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw, TIDAL_API_BASE_URL);
    return parsed.searchParams.get("page[cursor]") || "";
  } catch (_error) {
    return "";
  }
}

async function fetchTidalJson(url) {
  assertTidalAvailable();
  acquireLocalQuota();

  const accessToken = await fetchTidalAccessToken();
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/vnd.api+json, application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "music-link-swapper/1.0"
    }
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw buildTidalHttpError(response.status, payload);
  }

  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw buildTidalJsonApiError(payload.errors[0]);
  }

  return payload;
}

async function fetchTidalAccessToken() {
  assertTidalAvailable();

  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + TOKEN_EXPIRY_SKEW_MS) {
    return tokenCache.accessToken;
  }

  const clientId = String(process.env.TIDAL_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.TIDAL_CLIENT_SECRET || "").trim();
  const response = await fetchWithTimeout(TIDAL_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "music-link-swapper/1.0"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    }).toString()
  });
  const payload = await readJson(response);

  if (!response.ok || !payload?.access_token) {
    throw buildTidalHttpError(response.status || 503, payload, "tidal auth failed");
  }

  tokenCache = {
    accessToken: String(payload.access_token),
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600) || 3600) * 1000
  };

  return tokenCache.accessToken;
}

function assertTidalAvailable() {
  if (!isTidalMatchingEnabled()) {
    const error = new Error("tidal matching disabled");
    error.statusCode = 503;
    error.temporary = true;
    throw error;
  }

  if (!isTidalConfigured()) {
    const error = new Error("tidal credentials missing");
    error.statusCode = 503;
    error.temporary = true;
    throw error;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

function buildTidalHttpError(statusCode, payload, fallback = "tidal api failed") {
  const jsonApiError = Array.isArray(payload?.errors) && payload.errors.length ? payload.errors[0] : null;
  if (jsonApiError) return buildTidalJsonApiError(jsonApiError, statusCode);

  const message = sanitizeErrorMessage(payload?.error_description || payload?.error || fallback);
  const error = new Error(message);
  error.statusCode = statusCode || 502;
  error.notFound = error.statusCode === 404;
  error.temporary = error.statusCode === 429 || error.statusCode >= 500 || error.statusCode === 401 || error.statusCode === 403;
  return error;
}

function buildTidalJsonApiError(payloadError, fallbackStatus = 502) {
  const statusCode = Number(payloadError?.status || fallbackStatus || 502) || 502;
  const message = sanitizeErrorMessage(
    payloadError?.title || payloadError?.detail || payloadError?.code || "tidal api error"
  );
  const error = new Error(message);
  error.code = String(payloadError?.code || "");
  error.statusCode = statusCode;
  error.notFound = statusCode === 404;
  error.temporary = statusCode === 429 || statusCode >= 500 || statusCode === 401 || statusCode === 403;
  return error;
}

function sanitizeErrorMessage(value) {
  return String(value || "tidal api error")
    .replace(/bearer\s+[a-z0-9._~+/=-]+/gi, "bearer [redacted]")
    .replace(/basic\s+[a-z0-9._~+/=-]+/gi, "basic [redacted]")
    .replace(/[a-z0-9]{24,}\.[a-z0-9._-]{20,}/gi, "[redacted]")
    .slice(0, 180);
}

function acquireLocalQuota() {
  const now = Date.now();
  while (requestTimestamps.length && requestTimestamps[0] <= now - LOCAL_QUOTA_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= LOCAL_QUOTA_MAX_REQUESTS) {
    const error = new Error("tidal local quota exceeded");
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
