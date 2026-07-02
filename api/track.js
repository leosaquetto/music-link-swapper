import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  isMusicLibraryEnabled,
  readCachedResultByTrackId
} from "../server/lib/music-library.js";

const TRACK_ID_PATTERN = /^trk_[a-f0-9]{20}$/i;
const DEFAULT_SITE_NAME = "music link swapper";
const PREVIEW_APP_NAME = "Music Swapper";
const PREVIEW_TYPE_LABEL = "Música";
const DEFAULT_TITLE = "music link swapper";
const DEFAULT_DESCRIPTION = "troque links de música entre plataformas.";
const DEFAULT_IMAGE_PATH = "/assets/logo.png";
const DEFAULT_ICON_PATH = "/assets/faveicon.png";
const PUBLIC_PREVIEW_VERSION = "2";
const ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup";
const PREVIEW_LOOKUP_TIMEOUT_MS = 2_500;
const previewLookupCache = new Map();

let cachedIndexHtml = null;

export default async function handler(req, res) {
  if (isPagePreviewRequest(req)) {
    return handlePagePreview(req, res);
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "método não permitido" });
  }

  const trackId = getTrackId(req);
  if (!trackId || !TRACK_ID_PATTERN.test(trackId)) {
    return res.status(400).json({ ok: false, error: "trackId inválido" });
  }

  if (!isMusicLibraryEnabled()) {
    return res.status(503).json({
      ok: false,
      error: "biblioteca persistente não configurada"
    });
  }

  const result = await readCachedResultByTrackId(trackId, { cacheStatus: "hit" });
  if (!result) {
    return res.status(404).json({
      ok: false,
      error: "card público não encontrado"
    });
  }

  return res.status(200).json({ ok: true, data: result });
}

async function handlePagePreview(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("método não permitido");
  }

  const origin = getRequestOrigin(req);
  const trackId = getPreviewTrackId(req);
  const track = trackId ? await readPreviewTrack(trackId) : null;
  const html = await getIndexHtml();
  const pageHtml = injectSharePreviewMeta(html, buildPreviewMeta({ origin, track, trackId }));

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", track ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=60");
  return req.method === "HEAD" ? res.status(200).end() : res.status(200).send(pageHtml);
}

function isPagePreviewRequest(req) {
  try {
    const url = new URL(req?.url || "", "http://localhost");
    return url.pathname === "/" || url.pathname === "";
  } catch (_error) {
    return false;
  }
}

async function getIndexHtml() {
  if (!cachedIndexHtml) {
    cachedIndexHtml = await readFile(resolve(process.cwd(), "index.html"), "utf8");
  }
  return cachedIndexHtml;
}

async function readPreviewTrack(trackId) {
  if (!TRACK_ID_PATTERN.test(trackId)) return null;
  try {
    const track = await readCachedResultByTrackId(trackId, { cacheStatus: "hit" });
    return enrichLegacyPreviewTrack(track);
  } catch (_error) {
    return null;
  }
}

function buildPreviewMeta({ origin, track, trackId }) {
  const canonicalUrl = trackId
    ? `${origin}/?track=${encodeURIComponent(trackId)}&preview=${PUBLIC_PREVIEW_VERSION}`
    : `${origin}/`;
  const trackTitle = cleanText(track?.title) || DEFAULT_TITLE;
  const artist = extractPrimaryArtist(track?.artist || track?.description);
  const image = absoluteUrl(cleanText(track?.image) || DEFAULT_IMAGE_PATH, origin);
  const icon = absoluteUrl(DEFAULT_ICON_PATH, origin);
  const title = track ? buildTrackPreviewTitle(trackTitle, artist) : DEFAULT_TITLE;
  const description = track ? buildTrackPreviewDescription(track) : DEFAULT_DESCRIPTION;
  const documentTitle = track && trackTitle !== DEFAULT_TITLE
    ? `${title} | ${DEFAULT_SITE_NAME}`
    : DEFAULT_TITLE;

  return {
    canonicalUrl,
    description,
    documentTitle,
    icon,
    image,
    imageAlt: track ? `${trackTitle}${artist ? ` - ${artist}` : ""}` : DEFAULT_SITE_NAME,
    siteName: DEFAULT_SITE_NAME,
    title,
    type: track ? "music.song" : "website"
  };
}

export function injectSharePreviewMeta(html, meta) {
  const tags = [
    `<link rel="canonical" href="${escapeHtmlAttribute(meta.canonicalUrl)}" />`,
    `<link rel="shortcut icon" type="image/png" href="${escapeHtmlAttribute(meta.icon || meta.image)}" />`,
    `<link rel="icon" type="image/png" sizes="192x192" href="${escapeHtmlAttribute(meta.icon || meta.image)}" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${escapeHtmlAttribute(meta.icon || meta.image)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttribute(meta.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttribute(meta.siteName)}" />`,
    `<meta property="og:type" content="${escapeHtmlAttribute(meta.type)}" />`,
    `<meta property="og:title" content="${escapeHtmlAttribute(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttribute(meta.description)}" />`,
    `<meta property="og:logo" content="${escapeHtmlAttribute(meta.icon || meta.image)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttribute(meta.image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtmlAttribute(meta.image)}" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttribute(meta.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttribute(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttribute(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttribute(meta.image)}" />`
  ].join("\n    ");

  return html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtmlText(meta.documentTitle)}</title>`)
    .replace(/\s*<link rel="canonical" href="[^"]*" \/>\s*<meta property="og:url" content="[^"]*" \/>/, `\n    ${tags}`);
}

async function enrichLegacyPreviewTrack(track) {
  if (!track) return null;
  const hasDuration = Number(track.durationMs || track.duration || 0) > 0;
  const hasYear = Boolean(extractPreviewYear(track));
  if (hasDuration && hasYear) return track;

  const appleLink = (Array.isArray(track.links) ? track.links : []).find(link => link?.type === "appleMusic")?.url;
  const lookup = parseAppleTrackLookup(appleLink);
  if (!lookup) return track;

  const metadata = await fetchApplePreviewMetadata(lookup).catch(() => null);
  if (!metadata) return track;
  return {
    ...track,
    durationMs: Number(track.durationMs || metadata.durationMs || 0) || 0,
    releaseYear: cleanText(track.releaseYear || metadata.releaseYear),
    recordType: cleanText(track.recordType || metadata.recordType)
  };
}

function parseAppleTrackLookup(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== "music.apple.com") return null;
    const id = cleanText(url.searchParams.get("i"));
    if (!/^\d{5,20}$/.test(id)) return null;
    const country = cleanText(url.pathname.split("/").filter(Boolean)[0]).toUpperCase();
    return { id, country: /^[A-Z]{2}$/.test(country) ? country : "US" };
  } catch (_error) {
    return null;
  }
}

async function fetchApplePreviewMetadata({ id, country }) {
  const cacheKey = `${country}:${id}`;
  if (previewLookupCache.has(cacheKey)) return previewLookupCache.get(cacheKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PREVIEW_LOOKUP_TIMEOUT_MS);
  try {
    const url = new URL(ITUNES_LOOKUP_URL);
    url.searchParams.set("id", id);
    url.searchParams.set("country", country);
    url.searchParams.set("entity", "song");
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const item = Array.isArray(payload?.results)
      ? payload.results.find(result => String(result?.trackId || "") === id) || payload.results[0]
      : null;
    if (!item) return null;
    const releaseYear = String(item.releaseDate || "").match(/\b(19\d{2}|20\d{2})\b/)?.[1] || "";
    const metadata = {
      durationMs: Number(item.trackTimeMillis || 0) || 0,
      releaseYear,
      recordType: item.kind === "song" ? PREVIEW_TYPE_LABEL : cleanText(item.wrapperType)
    };
    previewLookupCache.set(cacheKey, metadata);
    return metadata;
  } finally {
    clearTimeout(timer);
  }
}

function getTrackId(req) {
  const queryValue = req?.query?.trackId;
  if (typeof queryValue === "string") return queryValue.trim();
  if (Array.isArray(queryValue)) return String(queryValue[0] || "").trim();

  try {
    const url = new URL(req?.url || "", "http://localhost");
    return String(url.searchParams.get("trackId") || "").trim();
  } catch (_error) {
    return "";
  }
}

function getPreviewTrackId(req) {
  const queryValue = req?.query?.track;
  if (typeof queryValue === "string") return queryValue.trim();
  if (Array.isArray(queryValue)) return String(queryValue[0] || "").trim();

  try {
    const url = new URL(req?.url || "", "http://localhost");
    return String(url.searchParams.get("track") || "").trim();
  } catch (_error) {
    return "";
  }
}

function getRequestOrigin(req) {
  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "swapper.leosaquetto.com").split(",")[0].trim();
  const proto = String(req?.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto || "https"}://${host || "swapper.leosaquetto.com"}`;
}

function absoluteUrl(value, origin) {
  try {
    return new URL(value, origin).toString();
  } catch (_error) {
    return new URL(DEFAULT_IMAGE_PATH, origin).toString();
  }
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractPrimaryArtist(value) {
  return cleanText(value).split(/\s+[•·]\s+/)[0]?.trim() || "";
}

function buildTrackPreviewTitle(title, artist) {
  return `${title}${artist ? ` de ${artist}` : ""} no ${PREVIEW_APP_NAME}`;
}

function buildTrackPreviewDescription(track) {
  const type = normalizePreviewType(track?.recordType);
  const year = extractPreviewYear(track);
  const duration = formatPreviewDuration(track?.durationMs || track?.duration || 0);
  const parts = [type, year, duration ? `Duração ${duration}` : ""].filter(Boolean);
  return parts.join(" · ") || "links desta música no music link swapper.";
}

function normalizePreviewType(value) {
  const text = cleanText(value).toLowerCase();
  if (!text || ["song", "track", "music.song", "music", "música", "musica"].includes(text)) {
    return PREVIEW_TYPE_LABEL;
  }
  return cleanText(value);
}

function extractPreviewYear(track) {
  const candidates = [
    track?.releaseYear,
    track?.year,
    track?.releaseDate,
    track?.release_date,
    track?.album,
    track?.title,
    track?.description,
    track?.artist
  ];
  for (const candidate of candidates) {
    const match = String(candidate || "").match(/\b(19\d{2}|20\d{2})\b/);
    if (match) return match[1];
  }
  return "";
}

function formatPreviewDuration(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "";
  const totalSeconds = Math.max(1, Math.round((number < 10_000 ? number * 1000 : number) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function escapeHtmlText(value) {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replaceAll('"', "&quot;");
}
