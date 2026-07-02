import {
  buildYoutubePlatformLinks,
  canonicalizeMediaUrl,
  isArtistCreditMatch,
  normalizeSearchText,
  scoreTextAlignment,
  tokenize
} from "./music-contract.js";
import { scoreYoutubeCandidate } from "./youtube-data.js";

const REQUEST_TIMEOUT_MS = 6_000;
const SPOTIFY23_HOST = "spotify23.p.rapidapi.com";
const SPOTIFY23_BASE_URL = `https://${SPOTIFY23_HOST}`;
const SPOTIFY_WEB_API3_HOST = "spotify-web-api3.p.rapidapi.com";
const SPOTIFY_WEB_API3_BASE_URL = `https://${SPOTIFY_WEB_API3_HOST}`;
const SHAZAM_HOST = "shazam.p.rapidapi.com";
const SHAZAM_BASE_URL = `https://${SHAZAM_HOST}`;
const MUSICDATA_HOST = "musicdata-api.p.rapidapi.com";
const MUSICDATA_BASE_URL = `https://${MUSICDATA_HOST}`;
const YOUTUBE_MUSIC_API3_HOST = "youtube-music-api3.p.rapidapi.com";
const YOUTUBE_MUSIC_API3_BASE_URL = `https://${YOUTUBE_MUSIC_API3_HOST}`;
const DEFAULT_DAILY_REQUEST_LIMIT = 8;
const SPOTIFY_MIN_SCORE = 72;
const SHAZAM_MIN_SCORE = 72;
const YOUTUBE_MIN_SCORE = 72;
const YOUTUBE_VERIFIED_SCORE = 84;

let quotaDay = "";
let quotaCount = 0;

export function isRapidApiFallbackEnabled() {
  return (
    String(process.env.RAPIDAPI_FALLBACKS_ENABLED || "").toLowerCase() === "true" &&
    Boolean(getRapidApiKey())
  );
}

export function isRapidApiSpotifyEnabled() {
  return isRapidApiFallbackEnabled() && String(process.env.RAPIDAPI_SPOTIFY_ENABLED || "true").toLowerCase() !== "false";
}

export function isRapidApiSpotifyWebApi3Enabled() {
  return isRapidApiFallbackEnabled() && String(process.env.RAPIDAPI_SPOTIFY_WEB_API3_ENABLED || "true").toLowerCase() !== "false";
}

export function isRapidApiShazamEnabled() {
  return isRapidApiFallbackEnabled() && String(process.env.RAPIDAPI_SHAZAM_ENABLED || "true").toLowerCase() !== "false";
}

export function isRapidApiMusicDataEnabled() {
  return isRapidApiFallbackEnabled() && String(process.env.RAPIDAPI_MUSICDATA_ENABLED || "true").toLowerCase() !== "false";
}

export function isRapidApiYoutubeMusicEnabled() {
  return isRapidApiFallbackEnabled() && String(process.env.RAPIDAPI_YOUTUBE_MUSIC_ENABLED || "true").toLowerCase() !== "false";
}

export async function searchRapidApiSpotifyTrack(target = {}) {
  if (!isRapidApiSpotifyEnabled()) return null;

  const normalizedTarget = normalizeTarget(target);
  const query = normalizedTarget.query;
  if (!query) return null;

  const url = new URL(`${SPOTIFY23_BASE_URL}/search/`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "tracks");
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "10");
  url.searchParams.set("numberOfTopResults", "5");
  const countryCode = getCountryCode(normalizedTarget.countryCode);
  if (countryCode) url.searchParams.set("gl", countryCode);

  const payload = await fetchRapidApiJson(url.toString(), SPOTIFY23_HOST);
  const candidates = extractSpotifyCandidates(payload)
    .map(candidate => ({
      ...candidate,
      score: scoreRapidSpotifyCandidate(normalizedTarget, candidate)
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0] || null;
  if (!best || best.score < SPOTIFY_MIN_SCORE) return null;

  return {
    type: "spotify",
    id: best.id,
    title: best.title,
    artist: best.artist,
    album: best.album,
    durationMs: best.durationMs,
    image: best.image,
    url: best.url,
    isVerified: best.score >= SPOTIFY_MIN_SCORE,
    source: "rapidapi_spotify23",
    score: best.score
  };
}

export async function searchRapidApiSpotifyWebApi3Track(target = {}) {
  if (!isRapidApiSpotifyWebApi3Enabled()) return null;

  const normalizedTarget = normalizeTarget(target);
  const query = normalizedTarget.query;
  if (!query) return null;

  const payload = await fetchRapidApiJson(
    `${SPOTIFY_WEB_API3_BASE_URL}/v1/social/spotify/searchtracks`,
    SPOTIFY_WEB_API3_HOST,
    {
      method: "POST",
      body: JSON.stringify({
        terms: query,
        limit: 10
      })
    }
  );
  const candidates = extractSpotifyCandidates(payload)
    .map(candidate => ({
      ...candidate,
      score: scoreRapidSpotifyCandidate(normalizedTarget, candidate)
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0] || null;
  if (!best || best.score < SPOTIFY_MIN_SCORE) return null;

  return {
    type: "spotify",
    id: best.id,
    title: best.title,
    artist: best.artist,
    album: best.album,
    durationMs: best.durationMs,
    image: best.image,
    url: best.url,
    isVerified: best.score >= SPOTIFY_MIN_SCORE,
    source: "rapidapi_spotify_web_api3",
    score: best.score
  };
}

export async function searchRapidApiShazamTrack(target = {}) {
  if (!isRapidApiShazamEnabled()) return null;

  const normalizedTarget = normalizeTarget(target);
  const query = normalizedTarget.query;
  if (!query || !normalizedTarget.title || !normalizedTarget.artist) return null;

  const url = new URL(`${SHAZAM_BASE_URL}/v2/search`);
  url.searchParams.set("term", query);
  url.searchParams.set("locale", getShazamLocale(normalizedTarget.locale));
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "5");

  const payload = await fetchRapidApiJson(url.toString(), SHAZAM_HOST);
  const candidates = extractShazamCandidates(payload)
    .map(candidate => ({
      ...candidate,
      score: scoreRapidShazamCandidate(normalizedTarget, candidate)
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0] || null;
  if (!best || best.score < SHAZAM_MIN_SCORE) return null;

  return {
    type: "shazam",
    id: best.id,
    title: best.title,
    artist: best.artist,
    album: best.album,
    durationMs: best.durationMs,
    image: best.image,
    appleMusicUrl: best.appleMusicUrl,
    appleMusicTrackId: best.appleMusicTrackId,
    url: best.shazamUrl,
    isVerified: best.score >= SHAZAM_MIN_SCORE,
    source: "rapidapi_shazam",
    score: best.score
  };
}

export async function fetchRapidApiMusicDataYoutubeVideo(videoId) {
  if (!isRapidApiMusicDataEnabled()) return null;

  const id = String(videoId || "").trim();
  if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;

  const url = `${MUSICDATA_BASE_URL}/youtube/video/${encodeURIComponent(id)}`;
  const payload = await fetchRapidApiJson(url, MUSICDATA_HOST);
  const item = normalizeMusicDataYoutubeVideoPayload(payload, id);
  if (!item?.title && !item?.artist) return null;
  return item;
}

export async function searchRapidApiYoutubeMusicTrack(target = {}) {
  if (!isRapidApiYoutubeMusicEnabled()) return null;

  const normalizedTarget = normalizeTarget(target);
  const query = normalizedTarget.query;
  if (!query) return null;

  const url = new URL(`${YOUTUBE_MUSIC_API3_BASE_URL}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "song");

  const payload = await fetchRapidApiJson(url.toString(), YOUTUBE_MUSIC_API3_HOST);
  const candidates = extractYoutubeMusicCandidates(payload)
    .map((candidate, index) => ({
      ...candidate,
      position: index,
      score: scoreRapidYoutubeCandidate(normalizedTarget, candidate, index)
    }))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0] || null;
  if (!best || best.score < YOUTUBE_MIN_SCORE || !best.videoId) return null;

  return {
    type: "youtubeMusic",
    videoId: best.videoId,
    title: best.title,
    artist: best.artist,
    album: best.album,
    durationMs: best.durationMs,
    url: `https://music.youtube.com/watch?v=${best.videoId}`,
    isVerified: best.score >= YOUTUBE_VERIFIED_SCORE,
    source: "rapidapi_youtube_music_api3",
    score: best.score,
    links: buildYoutubePlatformLinks(best.videoId, {
      source: "rapidapi_youtube_music_api3",
      isVerified: best.score >= YOUTUBE_VERIFIED_SCORE
    })
  };
}

export function scoreRapidSpotifyCandidate(target = {}, candidate = {}) {
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

  if (targetTitle && candidateTitle === targetTitle) score += 30;
  else if (targetTitle && candidateTitle.includes(targetTitle)) score += 10;

  if (targetArtist && candidateArtist === targetArtist) score += 24;
  else if (isArtistCreditMatch(target.artist, candidate.artist)) score += 20;

  if (targetAlbum && candidateAlbum === targetAlbum) score += 10;
  else if (targetAlbum && candidateAlbum.includes(targetAlbum)) score += 5;

  const targetDurationMs = Number(target.durationMs || 0) || 0;
  const candidateDurationMs = Number(candidate.durationMs || 0) || 0;
  if (targetDurationMs && candidateDurationMs) {
    const diff = Math.abs(targetDurationMs - candidateDurationMs);
    if (diff <= 2_500) score += 12;
    else if (diff <= 6_000) score += 6;
    else if (diff > 12_000) score -= 14;
  }

  score += scoreQualifierAlignment(target.title || target.query, candidate.title);
  return Math.max(0, Math.min(150, Math.round(score)));
}

function normalizeMusicDataYoutubeVideoPayload(payload, videoId) {
  const items = Array.isArray(payload) ? payload : [payload];
  const first = items.find(item => item && typeof item === "object") || null;
  if (!first) return null;

  const rawTrack = String(first.track || first.title || first.name || "").trim();
  const parsed = parseMusicDataTrackTitle(rawTrack);
  const link = String(first.link || first.url || "").trim();
  return {
    type: "youtube",
    videoId,
    title: parsed.title,
    artist: parsed.artist,
    image: "",
    url: link,
    rawTitle: rawTrack,
    source: "rapidapi_musicdata"
  };
}

function parseMusicDataTrackTitle(value) {
  const clean = stripMusicVideoQualifiers(value);
  const parts = clean.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      artist: parts[0],
      title: stripMusicVideoQualifiers(parts.slice(1).join(" - "))
    };
  }

  return { title: clean, artist: "" };
}

function stripMusicVideoQualifiers(value) {
  return String(value || "")
    .replace(/\s*[\[(]\s*official\s+(music\s+video|lyric\s+video|lyrics?\s+video|audio|video)\s*[\])]\s*/gi, " ")
    .replace(/\s*[\[(]\s*(lyrics?|visualizer|audio|music\s+video|lyric\s+video)\s*[\])]\s*/gi, " ")
    .replace(/\s+-\s*topic$/i, "")
    .replace(/\s+vevo$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreRapidShazamCandidate(target = {}, candidate = {}) {
  return scoreRapidSpotifyCandidate(target, candidate);
}

export function scoreRapidYoutubeCandidate(target = {}, candidate = {}, position = 0) {
  const youtubeScore = scoreYoutubeCandidate(
    {
      title: target.title,
      artist: target.artist,
      durationMs: target.durationMs
    },
    {
      title: candidate.title,
      channelTitle: candidate.artist,
      description: [candidate.album, candidate.description].filter(Boolean).join(" "),
      durationMs: candidate.durationMs,
      categoryId: "10",
      licensedContent: true,
      position
    }
  );

  let score = youtubeScore;
  if (candidate.artist && isArtistCreditMatch(target.artist, candidate.artist)) score += 10;
  score += scoreQualifierAlignment(target.title || target.query, candidate.title);
  return Math.max(0, Math.min(150, Math.round(score)));
}

function normalizeTarget(target = {}) {
  const title = String(target.title || target.trackName || "").trim();
  const artist = String(target.artist || target.artistName || target.description || "").trim();
  const album = String(target.album || target.albumName || "").trim();
  const query = String(target.query || [title, artist].filter(Boolean).join(" ")).trim();
  return {
    title,
    artist,
    album,
    query,
    durationMs: Number(target.durationMs || target.duration || 0) || 0,
    countryCode: normalizeCountryCode(target.countryCode),
    locale: normalizeLocale(target.locale)
  };
}

function extractSpotifyCandidates(payload) {
  const objects = collectObjects(payload, 7);
  const byId = new Map();

  for (const object of objects) {
    const candidate = normalizeSpotifyCandidate(object?.data || object);
    if (!candidate.id || !candidate.url || !candidate.title || !candidate.artist) continue;
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }

  return Array.from(byId.values());
}

function normalizeSpotifyCandidate(track = {}) {
  const id = extractSpotifyId(track);
  const title = String(track.name || track.title || track.trackName || track.track || "").trim();
  const artist = extractArtistNames(track).join(", ");
  const album = String(
    track.album?.name ||
      track.albumOfTrack?.name ||
      track.albumName ||
      track.releaseName ||
      ""
  ).trim();
  const durationMs = normalizeDurationMs(
    track.duration?.totalMilliseconds ||
      track.duration_ms ||
      track.durationMs ||
      track.duration ||
      track.trackDuration
  );
  const image = pickImageUrl(
    track.album?.images ||
      track.albumOfTrack?.coverArt?.sources ||
      track.coverArt?.sources ||
      track.images ||
      track.image
  );
  const url = canonicalSpotifyTrackUrl(track.external_urls?.spotify || track.externalUrls?.spotify || track.link || track.url || track.href || track.uri || id);

  return {
    type: "spotify",
    id,
    title,
    artist,
    album,
    durationMs,
    image,
    url
  };
}

function extractShazamCandidates(payload) {
  const hits = Array.isArray(payload?.tracks?.hits) ? payload.tracks.hits : [];
  const byId = new Map();

  for (const hit of hits) {
    const candidate = normalizeShazamCandidate(hit?.track || hit);
    if (!candidate.id || !candidate.title || !candidate.artist) continue;
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }

  return Array.from(byId.values());
}

function normalizeShazamCandidate(track = {}) {
  const id = String(track.key || track.id || "").trim();
  const title = String(track.title || track.name || "").trim();
  const artist = String(track.subtitle || track.artist || track.artistName || "").trim();
  const image = String(track.images?.coverarthq || track.images?.coverart || track.share?.image || "").trim();
  const shazamUrl = String(track.url || track.share?.href || "").trim();
  const appleMusicUrl = extractShazamAppleMusicUrl(track);
  const appleMusicTrackId = extractShazamAppleMusicTrackId(track, appleMusicUrl);

  return {
    type: "shazam",
    id,
    title,
    artist,
    album: "",
    durationMs: 0,
    image,
    shazamUrl,
    appleMusicUrl,
    appleMusicTrackId
  };
}

function extractYoutubeMusicCandidates(payload) {
  const objects = collectObjects(payload, 7);
  const byId = new Map();

  for (const object of objects) {
    const candidate = normalizeYoutubeMusicCandidate(object?.data || object);
    if (!candidate.videoId || !candidate.title || !candidate.artist) continue;
    if (!byId.has(candidate.videoId)) byId.set(candidate.videoId, candidate);
  }

  return Array.from(byId.values());
}

function normalizeYoutubeMusicCandidate(item = {}) {
  const videoId = String(item.videoId || item.video_id || item.id || item.youtubeId || "").trim();
  const title = String(item.title || item.name || item.trackName || "").trim();
  const artist = extractArtistNames(item).join(", ") || String(
    item.artist || item.author || item.channelTitle || parseSubtitleArtist(item.subtitle) || ""
  ).trim();
  const album = String(item.album?.name || item.album?.title || item.albumName || "").trim();
  const durationMs = normalizeDurationMs(item.duration || item.duration_seconds || item.durationSeconds || item.length || item.lengthSeconds);
  const image = pickImageUrl(item.thumbnails || item.thumbnail || item.image || item.images);

  return {
    type: "youtubeMusic",
    videoId,
    title,
    artist,
    album,
    durationMs,
    image,
    description: String(item.description || item.subtitle || "").trim(),
    url: videoId ? `https://music.youtube.com/watch?v=${videoId}` : ""
  };
}

function parseSubtitleArtist(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/•|\||-/)
    .map(part => part.trim())
    .find(Boolean) || "";
}

function extractShazamAppleMusicUrl(track = {}) {
  const values = [];
  collectShazamActionUris(track?.hub?.options, values);
  collectShazamActionUris(track?.hub?.actions, values);

  for (const value of values) {
    const canonical = canonicalizeAppleMusicTrackUrl(value);
    if (canonical) return canonical;
  }

  return "";
}

function collectShazamActionUris(value, out) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectShazamActionUris(item, out);
    return;
  }
  if (typeof value !== "object") return;
  if (typeof value.uri === "string") out.push(value.uri);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectShazamActionUris(child, out);
  }
}

function canonicalizeAppleMusicTrackUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    if (!host.includes("music.apple.com")) return "";
    const trackId = url.searchParams.get("i") || "";
    if (!/^\d{5,}$/.test(trackId)) return "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (key !== "i") url.searchParams.delete(key);
    }
    url.hash = "";
    return canonicalizeMediaUrl(url.toString());
  } catch (_error) {
    return "";
  }
}

function extractShazamAppleMusicTrackId(track = {}, appleMusicUrl = "") {
  try {
    const url = new URL(String(appleMusicUrl || "").trim());
    const id = url.searchParams.get("i") || "";
    if (/^\d{5,}$/.test(id)) return id;
  } catch (_error) {
    // Fall back to the hub action id below.
  }

  const actions = Array.isArray(track?.hub?.actions) ? track.hub.actions : [];
  for (const action of actions) {
    if (String(action?.type || "").toLowerCase() !== "applemusicplay") continue;
    const id = String(action?.id || "").trim();
    if (/^\d{5,}$/.test(id)) return id;
  }

  return "";
}

function extractSpotifyId(track = {}) {
  const direct = String(track.id || track.trackId || "").trim();
  if (/^[A-Za-z0-9]{22}$/.test(direct)) return direct;

  const uri = String(track.uri || "").trim();
  const uriMatch = uri.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  if (uriMatch) return uriMatch[1];

  const url = String(track.url || track.href || track.link || track.external_urls?.spotify || track.externalUrls?.spotify || "").trim();
  const urlMatch = url.match(/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/);
  return urlMatch?.[1] || "";
}

function canonicalSpotifyTrackUrl(value) {
  const raw = String(value || "").trim();
  const id = extractSpotifyId({ id: raw, uri: raw, url: raw });
  return id ? `https://open.spotify.com/track/${id}` : "";
}

function extractArtistNames(item = {}) {
  const direct = item.artist || item.artistName || item.author;
  if (typeof direct === "string" && direct.trim()) return [direct.trim()];

  const artists = item.artists?.items || item.artists || item.artistItems || item.singers || [];
  if (!Array.isArray(artists)) return [];

  return artists
    .map(artist => (
      typeof artist === "string"
        ? artist
        : artist?.profile?.name || artist?.name || artist?.title || artist?.artistName || ""
    ))
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function pickImageUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const first = value.find(item => item?.url || typeof item === "string");
    return pickImageUrl(first);
  }
  return String(value.url || value.src || value.thumbnail || "").trim();
}

function normalizeDurationMs(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") {
    if (value > 1000) return Math.round(value);
    return Math.round(value * 1000);
  }

  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) {
    const number = Number(raw);
    return number > 1000 ? number : number * 1000;
  }

  const iso = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    const hours = Number(iso[1] || 0) || 0;
    const minutes = Number(iso[2] || 0) || 0;
    const seconds = Number(iso[3] || 0) || 0;
    return ((hours * 60 + minutes) * 60 + seconds) * 1000;
  }

  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(raw)) {
    const parts = raw.split(":").map(part => Number(part) || 0);
    const seconds = parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
    return seconds * 1000;
  }

  return 0;
}

function scoreQualifierAlignment(targetTitle, candidateTitle) {
  const targetTokens = new Set(tokenize(targetTitle || ""));
  const candidateTokens = new Set(tokenize(candidateTitle || ""));
  let score = 0;
  for (const qualifier of ["live", "acoustic", "remix", "instrumental", "karaoke", "sped", "slowed"]) {
    if (!targetTokens.has(qualifier) && candidateTokens.has(qualifier)) score -= 12;
    if (targetTokens.has(qualifier) && !candidateTokens.has(qualifier)) score -= 5;
  }
  return score;
}

function collectObjects(value, maxDepth, out = []) {
  if (!value || maxDepth < 0) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, maxDepth - 1, out);
    return out;
  }
  if (typeof value !== "object") return out;

  out.push(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectObjects(child, maxDepth - 1, out);
  }
  return out;
}

async function fetchRapidApiJson(url, host, options = {}) {
  acquireDailyQuota();

  const response = await fetchWithTimeout(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-rapidapi-host": host,
      "x-rapidapi-key": getRapidApiKey(),
      ...(options.headers || {})
    },
    body: options.body
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(`rapidapi ${host} failed: ${response.status}`);
    error.statusCode = response.status;
    error.temporary = response.status === 429 || response.status >= 500;
    throw error;
  }

  if (!payload || typeof payload !== "object") return {};
  return payload;
}

function acquireDailyQuota() {
  const today = new Date().toISOString().slice(0, 10);
  if (quotaDay !== today) {
    quotaDay = today;
    quotaCount = 0;
  }

  const limit = clampNumber(process.env.RAPIDAPI_DAILY_REQUEST_LIMIT, 1, 1000, DEFAULT_DAILY_REQUEST_LIMIT);
  if (quotaCount >= limit) {
    const error = new Error("rapidapi local daily quota exceeded");
    error.statusCode = 429;
    error.temporary = true;
    throw error;
  }

  quotaCount += 1;
}

function getRapidApiKey() {
  return String(process.env.RAPIDAPI_KEY || "").trim();
}

function getCountryCode(preferredCountryCode = "") {
  return normalizeCountryCode(preferredCountryCode) || normalizeCountryCode(process.env.RAPIDAPI_COUNTRY_CODE) || "BR";
}

function getShazamLocale(preferredLocale = "") {
  return normalizeLocale(preferredLocale) || normalizeLocale(process.env.RAPIDAPI_SHAZAM_LOCALE) || "en-US";
}

function normalizeCountryCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function normalizeLocale(value) {
  const raw = String(value || "").trim().replace("_", "-");
  const match = raw.match(/^([a-z]{2})(?:-([a-z]{2}))?$/i);
  if (!match) return "";
  const language = match[1].toLowerCase();
  const region = match[2] ? match[2].toUpperCase() : "";
  return region ? `${language}-${region}` : "";
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
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

export function __resetRapidApiQuotaForTests() {
  quotaDay = "";
  quotaCount = 0;
}
