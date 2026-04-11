const PRIMARY_API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";
const SONGLINK_API_URL = "https://api.song.link/v1-alpha.1/links";

const SONGLINK_PRIORITY_HOSTS = [
  "pandora.com",
  "music.amazon.com",
  "amazon.com/music",
  "tidal.com",
  "soundcloud.com",
  "qobuz.com"
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "método não permitido"
    });
  }

  try {
    const { link, adapters } = req.body || {};

    if (!link || typeof link !== "string") {
      return res.status(400).json({
        ok: false,
        error: "link inválido"
      });
    }

    const platform = detectPlatformFromUrl(link);
    const shouldUseSongLinkFirst = shouldPrioritizeSongLink(link);

    const primaryResult = shouldUseSongLinkFirst
      ? await fetchSongLinkAsPrimary(link)
      : await fetchPrimaryApi(link, adapters);

    if (primaryResult.ok) {
      const enrichmentResult = shouldUseSongLinkFirst
        ? await fetchPrimaryApi(link, adapters)
        : await fetchSongLinkAsFallback(link);

      const mergedData = enrichmentResult.ok
        ? mergeLinkResults(primaryResult.data, enrichmentResult.data)
        : primaryResult.data;

      return res.status(200).json({ ok: true, data: mergedData });
    }

    const fallbackResult = shouldUseSongLinkFirst
      ? await fetchPrimaryApi(link, adapters)
      : await fetchSongLinkAsFallback(link);

    if (fallbackResult.ok) {
      return res.status(200).json({ ok: true, data: fallbackResult.data });
    }

    return res.status(primaryResult.status || 502).json({
      ok: false,
      error: buildFriendlyPlatformError(platform, primaryResult.error || fallbackResult.error)
    });
  } catch (_error) {
    return res.status(500).json({
      ok: false,
      error: "erro interno ao converter"
    });
  }
}

async function fetchPrimaryApi(link, adapters) {
  try {
    const upstream = await fetch(PRIMARY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        link,
        adapters: Array.isArray(adapters) && adapters.length ? adapters : undefined
      })
    });

    const text = await upstream.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_error) {
      return {
        ok: false,
        status: 502,
        error: "a api externa retornou uma resposta inválida"
      };
    }

    if (!upstream.ok) {
      const upstreamMessage =
        data?.message ||
        data?.error ||
        data?.details ||
        "erro ao consultar a api externa";

      return {
        ok: false,
        status: upstream.status,
        error: normalizeUpstreamError(upstreamMessage)
      };
    }

    return {
      ok: true,
      status: 200,
      data
    };
  } catch (_error) {
    return {
      ok: false,
      status: 502,
      error: "erro ao consultar a api externa"
    };
  }
}

async function fetchSongLinkAsPrimary(link) {
  return fetchSongLink(link, { markVerified: true });
}

async function fetchSongLinkAsFallback(link) {
  return fetchSongLink(link, { markVerified: true });
}

async function fetchSongLink(link, { markVerified = false } = {}) {
  try {
    const upstream = await fetch(`${SONGLINK_API_URL}?url=${encodeURIComponent(link)}`);
    const data = await upstream.json();

    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        error: data?.message || data?.error || "erro ao consultar song.link"
      };
    }

    const normalized = normalizeSongLinkPayload(data, { markVerified });
    if (!normalized?.links?.length) {
      return {
        ok: false,
        status: 404,
        error: "song.link sem links compatíveis"
      };
    }

    return {
      ok: true,
      status: 200,
      data: normalized
    };
  } catch (_error) {
    return {
      ok: false,
      status: 502,
      error: "erro ao consultar song.link"
    };
  }
}

function normalizeSongLinkPayload(data, { markVerified = false } = {}) {
  const entities = data?.entitiesByUniqueId || {};
  const entityId = data?.entityUniqueId;
  const entity = entities[entityId] || {};
  const linksByPlatform = data?.linksByPlatform || {};

  const links = Object.entries(linksByPlatform)
    .map(([platform, payload]) => {
      const url = payload?.url;
      if (!url) return null;

      return {
        type: mapSongLinkPlatform(platform),
        url,
        isVerified: markVerified
      };
    })
    .filter(Boolean);

  return {
    title: entity?.title || "música encontrada",
    description: [entity?.artistName, entity?.albumName].filter(Boolean).join(" • "),
    album: entity?.albumName || "",
    image: entity?.thumbnailUrl || "",
    universalLink: data?.pageUrl || "",
    links
  };
}

function mapSongLinkPlatform(platform) {
  const key = String(platform || "").toLowerCase();

  if (key === "youtube") return "youtube";
  if (key === "youtubemusic") return "youtubeMusic";
  if (key === "soundcloud") return "soundCloud";
  if (key === "amazonmusic" || key === "amazon") return "amazonMusic";
  if (key === "itunes" || key === "apple") return "itunes";

  return platform;
}

function normalizeUpstreamError(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("spotify metadata not found")) {
    return "metadata indisponível nesta plataforma agora";
  }

  if (text.includes("typeerror") && text.includes("atts") && text.includes("byartist")) {
    return "não consegui interpretar os metadados desse link agora";
  }

  return String(message || "erro ao consultar a api externa");
}

function detectPlatformFromUrl(url) {
  const value = String(url || "").toLowerCase();

  if (value.includes("spotify.")) return "spotify";
  if (value.includes("soundcloud.")) return "soundcloud";
  if (value.includes("pandora.")) return "pandora";
  if (value.includes("qobuz.")) return "qobuz";
  if (value.includes("tidal.")) return "tidal";
  if (value.includes("music.amazon.") || value.includes("amazon.com/music")) return "amazon music";

  return "serviço";
}

function buildFriendlyPlatformError(platform, rawError) {
  const lower = String(rawError || "").toLowerCase();

  if (lower.includes("não consegui") || lower.includes("metadata indisponível")) {
    return `não consegui buscar os metadados desse link no ${platform} agora. tente outro link ou tente novamente depois.`;
  }

  if (lower.includes("não consegui interpretar")) {
    return `não consegui interpretar os metadados desse link no ${platform} agora. tente outro link ou tente novamente depois.`;
  }

  return `não consegui buscar os metadados desse link no ${platform} agora. tente outro link ou tente novamente depois.`;
}

function shouldPrioritizeSongLink(link) {
  const lower = String(link || "").toLowerCase();
  return SONGLINK_PRIORITY_HOSTS.some(host => lower.includes(host));
}

function mergeLinkResults(primaryData, enrichmentData) {
  const base = Array.isArray(primaryData?.links) ? primaryData.links : [];
  const extra = Array.isArray(enrichmentData?.links) ? enrichmentData.links : [];

  if (!extra.length) return primaryData;

  const byType = new Map();

  for (const item of base) {
    if (!item?.type || !item?.url) continue;
    byType.set(String(item.type).toLowerCase(), { ...item });
  }

  for (const item of extra) {
    if (!item?.type || !item?.url) continue;
    const key = String(item.type).toLowerCase();
    if (!byType.has(key)) {
      byType.set(key, { ...item });
      continue;
    }

    const existing = byType.get(key);
    byType.set(key, {
      ...existing,
      isVerified: Boolean(existing?.isVerified || item?.isVerified)
    });
  }

  return {
    ...primaryData,
    links: Array.from(byType.values())
  };
}
