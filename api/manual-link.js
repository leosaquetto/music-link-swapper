import {
  isMusicLibraryEnabled,
  readCachedTrackById,
  upsertManualLink
} from "./lib/music-library.js";
import {
  canonicalizeMediaUrl,
  scoreTextAlignment,
  validatePlatformUrl
} from "./lib/music-contract.js";
import {
  extractDeezerTrackId,
  fetchDeezerTrackById
} from "./lib/deezer.js";

const SPOTIFY_OEMBED_API_URL = "https://open.spotify.com/oembed";
const ITUNES_LOOKUP_API_URL = "https://itunes.apple.com/lookup";
const REQUEST_TIMEOUT_MS = 6_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "método não permitido" });
  }

  if (!isMusicLibraryEnabled()) {
    return res.status(503).json({
      ok: false,
      error: "biblioteca persistente não configurada"
    });
  }

  const { trackId, platform, url, correctionToken } = req.body || {};
  const id = String(trackId || "").trim();
  const validation = validatePlatformUrl(platform, url);
  if (!id || !validation.ok) {
    return res.status(400).json({
      ok: false,
      error: "link manual inválido"
    });
  }

  const track = await readCachedTrackById(id);
  if (!track) {
    return res.status(404).json({
      ok: false,
      error: "música não encontrada na biblioteca"
    });
  }

  const isTrustedToken =
    Boolean(process.env.MANUAL_LINK_TOKEN) &&
    String(correctionToken || "") === process.env.MANUAL_LINK_TOKEN;
  const metadata = await fetchManualLinkMetadata(validation.platform, validation.url);
  const confidence = metadata
    ? scoreTextAlignment(
        { title: track.title, artist: track.artist },
        { title: metadata.title, artist: metadata.artist, description: metadata.description }
      )
    : 0;
  const shouldPublish = isTrustedToken || confidence >= 70;
  const result = await upsertManualLink({
    trackId: id,
    platform: validation.platform,
    url: canonicalizeMediaUrl(validation.url),
    isVerified: shouldPublish,
    status: shouldPublish ? "published" : "pending",
    confidence
  });

  return res.status(200).json({
    ok: true,
    data: {
      published: shouldPublish,
      confidence,
      result
    }
  });
}

async function fetchManualLinkMetadata(platform, url) {
  if (platform === "appleMusic") return fetchAppleMetadata(url);
  if (platform === "spotify") return fetchSpotifyMetadata(url);
  if (platform === "deezer") return fetchDeezerMetadata(url);
  return null;
}

async function fetchDeezerMetadata(url) {
  try {
    const trackId = extractDeezerTrackId(url);
    const track = trackId ? await fetchDeezerTrackById(trackId) : null;
    if (!track) return null;
    return {
      title: track.title,
      artist: track.artist,
      description: track.album || "Deezer"
    };
  } catch (_error) {
    return null;
  }
}

async function fetchAppleMetadata(url) {
  try {
    const parsed = new URL(url);
    const trackId = parsed.searchParams.get("i");
    if (!trackId) return null;
    const response = await fetchWithTimeout(`${ITUNES_LOOKUP_API_URL}?id=${encodeURIComponent(trackId)}&entity=song&limit=1`);
    if (!response.ok) return null;
    const payload = await response.json();
    const song = (Array.isArray(payload?.results) ? payload.results : []).find(item => String(item?.kind || "").toLowerCase() === "song");
    if (!song) return null;
    return {
      title: String(song.trackName || "").trim(),
      artist: String(song.artistName || "").trim(),
      description: String(song.collectionName || "").trim()
    };
  } catch (_error) {
    return null;
  }
}

async function fetchSpotifyMetadata(url) {
  try {
    const response = await fetchWithTimeout(`${SPOTIFY_OEMBED_API_URL}?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const parsed = parseSpotifyOEmbedTitle(payload?.title || "");
    return {
      title: parsed.title,
      artist: parsed.artist,
      description: "Spotify"
    };
  } catch (_error) {
    return null;
  }
}

function parseSpotifyOEmbedTitle(value) {
  const raw = String(value || "").trim();
  const index = raw.toLowerCase().lastIndexOf(" by ");
  if (index === -1) return { title: raw, artist: "" };
  return {
    title: raw.slice(0, index).trim(),
    artist: raw.slice(index + 4).trim()
  };
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
