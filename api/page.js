import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { readCachedResultByTrackId } from "./lib/music-library.js";

const TRACK_ID_PATTERN = /^trk_[a-f0-9]{20}$/i;
const DEFAULT_SITE_NAME = "music link swapper";
const DEFAULT_TITLE = "music link swapper";
const DEFAULT_DESCRIPTION = "troque links de música entre plataformas.";
const DEFAULT_IMAGE_PATH = "/assets/logo.png";

let cachedIndexHtml = null;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("método não permitido");
  }

  const origin = getRequestOrigin(req);
  const trackId = getTrackId(req);
  const track = trackId ? await readPreviewTrack(trackId) : null;
  const html = await getIndexHtml();
  const pageHtml = injectSharePreviewMeta(html, buildPreviewMeta({ origin, track, trackId }));

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", track ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=60");
  return req.method === "HEAD" ? res.status(200).end() : res.status(200).send(pageHtml);
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
    return await readCachedResultByTrackId(trackId, { cacheStatus: "hit" });
  } catch (_error) {
    return null;
  }
}

function buildPreviewMeta({ origin, track, trackId }) {
  const canonicalUrl = trackId ? `${origin}/?track=${encodeURIComponent(trackId)}` : `${origin}/`;
  const title = cleanText(track?.title) || DEFAULT_TITLE;
  const artist = cleanText(track?.description || track?.artist);
  const album = cleanText(track?.album);
  const image = absoluteUrl(cleanText(track?.image) || DEFAULT_IMAGE_PATH, origin);
  const description = track
    ? [artist, album].filter(Boolean).join(" • ") || "links desta música no music link swapper."
    : DEFAULT_DESCRIPTION;
  const documentTitle = track && title !== DEFAULT_TITLE
    ? `${title}${artist ? ` - ${artist}` : ""} | ${DEFAULT_SITE_NAME}`
    : DEFAULT_TITLE;

  return {
    canonicalUrl,
    description,
    documentTitle,
    image,
    imageAlt: track ? `${title}${artist ? ` - ${artist}` : ""}` : DEFAULT_SITE_NAME,
    siteName: DEFAULT_SITE_NAME,
    title,
    type: track ? "music.song" : "website"
  };
}

export function injectSharePreviewMeta(html, meta) {
  const tags = [
    `<link rel="canonical" href="${escapeHtmlAttribute(meta.canonicalUrl)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttribute(meta.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttribute(meta.siteName)}" />`,
    `<meta property="og:type" content="${escapeHtmlAttribute(meta.type)}" />`,
    `<meta property="og:title" content="${escapeHtmlAttribute(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttribute(meta.description)}" />`,
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

function getTrackId(req) {
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

function escapeHtmlText(value) {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replaceAll('"', "&quot;");
}
