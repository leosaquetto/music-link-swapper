const PRIMARY_API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";
const SONGLINK_API_URL = "https://api.song.link/v1-alpha.1/links";
const ITUNES_SEARCH_API_URL = "https://itunes.apple.com/search";

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

    if (platform === "spotify") {
      const spotifyFallback = await buildSpotifySearchFallback(link);
      if (spotifyFallback.ok) {
        return res.status(200).json({ ok: true, data: spotifyFallback.data });
      }
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

async function buildSpotifySearchFallback(link) {
  try {
    const metadata = await fetchSpotifyMetadataFromOg(link);
    if (!metadata?.title) {
      return {
        ok: false,
        status: 404,
        error: "spotify metadata indisponível"
      };
    }

    const normalizedQuery = buildSpotifyQueryFromMetadata(metadata);
    if (!normalizedQuery.query) {
      return {
        ok: false,
        status: 404,
        error: "query inválida para fallback spotify"
      };
    }

    const [itunesLink] = await Promise.all([
      fetchAppleMusicLinkFromItunes(normalizedQuery.query, normalizedQuery)
    ]);
    const links = buildSearchLinksFromQuery(normalizedQuery.query, link, itunesLink);

    if (!links.length) {
      return {
        ok: false,
        status: 404,
        error: "nenhum link encontrado para fallback spotify"
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        title: metadata.title,
        description: metadata.description || "resultado por busca",
        album: "",
        image: metadata.image || "",
        universalLink: "",
        links
      }
    };
  } catch (_error) {
    return {
      ok: false,
      status: 502,
      error: "erro no fallback de spotify"
    };
  }
}

async function fetchSpotifyMetadataFromOg(link) {
  const response = await fetch(link, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error("spotify html indisponível");
  }

  const html = await response.text();
  const title = extractOgValue(html, "og:title");
  const description = extractOgValue(html, "og:description");
  const image = extractOgValue(html, "og:image");
  const type = extractOgValue(html, "og:type");

  return { title, description, image, type };
}

function extractOgValue(html, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta\\s+[^>]*property=["']${escapedProperty}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*property=["']${escapedProperty}["'][^>]*>`,
      "i"
    )
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]).trim();
    }
  }

  return "";
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function buildSpotifyQueryFromMetadata(metadata) {
  const title = String(metadata?.title || "")
    .replace(/(\s(?:–|-)\s.*?\s(?:by|von|de|par|di|door|av|af|przez)\s.+)?\s\|\sSpotify$/i, "")
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}·]/gu,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  const [artistFromDescription = ""] = String(metadata?.description || "").split("·");
  const artist = artistFromDescription.trim();

  return {
    title,
    artist,
    query: [title, artist].filter(Boolean).join(" ").trim()
  };
}

async function fetchAppleMusicLinkFromItunes(query, normalizedQuery) {
  if (!query) return "";

  try {
    const response = await fetch(
      `${ITUNES_SEARCH_API_URL}?term=${encodeURIComponent(query)}&entity=song&limit=5`
    );

    if (!response.ok) return "";

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return "";

    const target = findBestMatch(results, {
      query,
      title: normalizedQuery?.title || "",
      artist: normalizedQuery?.artist || "",
      type: "song",
      getCandidateText: item => `${item?.trackName || ""} ${item?.artistName || ""}`,
      getCandidateKind: item => item?.kind || "",
      getCandidateArtist: item => item?.artistName || "",
      getCandidateTitle: item => item?.trackName || ""
    });
    return target?.trackViewUrl || "";
  } catch (_error) {
    return "";
  }
}

function findBestMatch(candidates, target) {
  const queryTokens = toQueryTokens(target?.query || "");
  const titleTokens = toQueryTokens(target?.title || "");
  const artistTokens = toQueryTokens(target?.artist || "");
  const desiredType = String(target?.type || "").toLowerCase();

  let best = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const text = target.getCandidateText(candidate);
    const candidateTokens = toQueryTokens(text);
    if (!candidateTokens.length) continue;
    const candidateTokenSet = new Set(candidateTokens);
    const queryTokenSet = new Set(queryTokens);

    const overlap = queryTokens.filter(token => candidateTokenSet.has(token)).length;
    const union = new Set([...queryTokenSet, ...candidateTokenSet]).size;
    const jaccard = union ? overlap / union : 0;

    const artistOverlap = artistTokens.filter(token => candidateTokenSet.has(token)).length;
    const titleOverlap = titleTokens.filter(token => candidateTokenSet.has(token)).length;

    let score = overlap * 8;
    score += jaccard * 25;
    score += artistOverlap * 5;
    score += titleOverlap * 4;

    const normalizedCandidateText = normalizeSearchText(text);
    const normalizedQueryText = normalizeSearchText(target?.query || "");
    if (normalizedCandidateText === normalizedQueryText) {
      score += 80;
    } else if (normalizedCandidateText.includes(normalizedQueryText)) {
      score += 18;
    }

    const candidateKind = String(target.getCandidateKind(candidate) || "").toLowerCase();
    if (desiredType && candidateKind.includes(desiredType)) {
      score += 10;
    }

    const candidateArtist = normalizeSearchText(target.getCandidateArtist(candidate));
    const queryArtist = normalizeSearchText(target?.artist || "");
    if (candidateArtist && queryArtist && candidateArtist === queryArtist) {
      score += 35;
    }

    const candidateTitle = normalizeSearchText(target.getCandidateTitle(candidate));
    const queryTitle = normalizeSearchText(target?.title || "");
    if (candidateTitle && queryTitle) {
      if (candidateTitle === queryTitle) score += 45;
      if (candidateTitle.startsWith(queryTitle)) score += 8;
    }

    if (containsAnyToken(candidateTokens, ["live", "karaoke", "instrumental", "sped", "slowed"])) {
      score -= 8;
    }
    if (containsAnyToken(candidateTokens, ["remaster", "remastered", "version", "edit", "mix"])) {
      score -= 5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best || candidates[0];
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toQueryTokens(value) {
  return normalizeSearchText(value)
    .split(" ")
    .filter(Boolean)
    .filter(token => !isStopword(token));
}

function isStopword(token) {
  const stopwords = new Set([
    "a",
    "as",
    "o",
    "os",
    "the",
    "of",
    "de",
    "da",
    "do",
    "and",
    "feat",
    "featuring",
    "ft"
  ]);
  return stopwords.has(token);
}

function containsAnyToken(tokens, candidates) {
  const tokenSet = new Set(tokens);
  return candidates.some(item => tokenSet.has(item));
}

function buildSearchLinksFromQuery(query, originalSpotifyUrl, itunesLink) {
  const encoded = encodeURIComponent(query);

  const links = [
    {
      type: "spotify",
      url: originalSpotifyUrl,
      isVerified: true
    },
    itunesLink
      ? {
          type: "appleMusic",
          url: itunesLink,
          isVerified: false
        }
      : {
          type: "appleMusic",
          url: `https://music.apple.com/br/search?term=${encoded}`,
          isVerified: false
        },
    {
      type: "youTube",
      url: `https://music.youtube.com/search?q=${encoded}`,
      isVerified: false
    },
    {
      type: "youtube",
      url: `https://www.youtube.com/results?search_query=${encoded}`,
      isVerified: false
    },
    {
      type: "deezer",
      url: `https://www.deezer.com/search/${encoded}`,
      isVerified: false
    },
    {
      type: "soundCloud",
      url: `https://soundcloud.com/search?q=${encoded}`,
      isVerified: false
    },
    {
      type: "tidal",
      url: `https://listen.tidal.com/search?q=${encoded}`,
      isVerified: false
    },
    {
      type: "qobuz",
      url: `https://www.qobuz.com/us-en/search?query=${encoded}`,
      isVerified: false
    },
    {
      type: "amazonMusic",
      url: `https://music.amazon.com/search/${encoded}`,
      isVerified: false
    }
  ];

  return links.filter(item => item.url);
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
