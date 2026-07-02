const DEFAULT_BRIDGE_URL = "https://statslc.leosaquetto.com/api/catalog-link-bridge";
const REQUEST_TIMEOUT_MS = 6_000;

export function isStatslcBridgeConfigured() {
  return (
    process.env.STATSLC_BRIDGE_ENABLED !== "false" &&
    Boolean(getStatslcBridgeUrl())
  );
}

export async function searchStatslcBridge(target = {}) {
  if (!isStatslcBridgeConfigured()) return null;

  const url = new URL(getStatslcBridgeUrl());
  const params = {
    q: target.query,
    title: target.title,
    artist: target.artist,
    durationMs: target.durationMs,
    spotifyId: target.spotifyId,
    appleMusicId: target.appleMusicId,
    statsfmTrackId: target.statsfmTrackId,
    isrc: target.isrc
  };

  for (const [key, value] of Object.entries(params)) {
    const text = String(value || "").trim();
    if (text) url.searchParams.set(key, text);
  }

  const headers = {
    Accept: "application/json"
  };
  const token = String(process.env.STATSLC_BRIDGE_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchWithTimeout(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`statslc bridge failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload?.matched || !Array.isArray(payload?.links) || !payload.links.length) {
    return null;
  }

  return {
    source: "statslc_bridge",
    score: Number(payload.score || 0) || 0,
    track: payload.track || null,
    links: payload.links.map(link => ({
      type: link?.type,
      id: link?.id,
      url: link?.url,
      isVerified: Boolean(link?.isVerified),
      source: "statslc_bridge"
    }))
  };
}

function getStatslcBridgeUrl() {
  return String(process.env.STATSLC_BRIDGE_URL || DEFAULT_BRIDGE_URL).trim();
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
