const PRIMARY_API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";
const SONGLINK_API_URL = "https://api.song.link/v1-alpha.1/links";
const ITUNES_SEARCH_API_URL = "https://itunes.apple.com/search";
const SPOTIFY_OEMBED_API_URL = "https://open.spotify.com/oembed";
const SPOTIFY_URL_CACHE_TTL_MS = 20 * 60 * 1000;
const SPOTIFY_QUERY_CACHE_TTL_MS = 60 * 60 * 1000;
const SPOTIFY_NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000;
const RATE_LIMIT_SHORT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_LONG_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_LINK_SHORT_MAX = 5;
const RATE_LIMIT_LINK_LONG_MAX = 20;
const RATE_LIMIT_QUERY_SHORT_MAX = 3;
const RATE_LIMIT_QUERY_LONG_MAX = 10;
const RATE_LIMIT_BLOCK_MS = 10 * 60 * 1000;
const RATE_LIMIT_STRIKES_BEFORE_BLOCK = 3;
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_IN_FLIGHT_REQUESTS = 40;
const MAX_QUERY_LENGTH = 160;
const MAX_LINK_LENGTH = 500;
const SAMPLE_RESULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const spotifyUrlCache = new Map();
const spotifyQueryCache = new Map();
const spotifyNegativeCache = new Map();
const sampleResultCache = new Map();
const requestRateLimitStore = new Map();
let inFlightRequests = 0;
const metrics = {
  requests: 0,
  rateLimited: 0,
  errors: 0,
  rejectedByLoad: 0,
  spotifyCacheHit: 0,
  spotifyCacheMiss: 0
};

const SONGLINK_PRIORITY_HOSTS = [
  "pandora.com",
  "music.amazon.com",
  "amazon.com/music",
  "tidal.com",
  "soundcloud.com",
  "qobuz.com"
];

const SAMPLE_CACHEABLE_LINKS = new Set([
  "https://music.apple.com/br/album/who-will-you-follow/1891104460?i=1891104594",
  "https://music.apple.com/br/album/swim/1868862375?i=1868862384",
  "https://music.apple.com/br/album/choka-choka/1891400123?i=1891400226",
  "https://music.apple.com/br/album/life-boat/1871085677?i=1871085701",
  "https://music.apple.com/br/album/space/1884652117?i=1884652125",
  "https://music.apple.com/br/album/zombie/1874720357?i=1874720787",
  "https://music.apple.com/br/album/orange-county-feat-bizarrap-kara-jackson-anoushka-shankar/1837237742?i=1837237867",
  "https://music.apple.com/br/album/i-could-have-sworn/1852602431?i=1852602432",
  "https://music.apple.com/br/album/pink-lemonade/1852384560?i=1852384561",
  "https://music.apple.com/br/album/pixelated-kisses/1849706656?i=1849706661",
  "https://music.apple.com/br/album/carlas-song/1870984032?i=1870984054",
  "https://music.apple.com/br/album/canzone-estiva/1882460107?i=1882460109",
  "https://music.apple.com/br/album/let-me-go-first/1862926375?i=1862926628",
  "https://music.apple.com/br/album/golden/1820264137?i=1820264150"
].map(normalizeSampleLink));

export default async function handler(req, res) {
  metrics.requests += 1;
  emitMetricsHeartbeat();

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "método não permitido"
    });
  }

  if (!acquireInFlightSlot()) {
    metrics.rejectedByLoad += 1;
    return res.status(503).json({
      ok: false,
      error: "servidor ocupado, tente novamente em instantes"
    });
  }

  try {
    const { link, adapters, queryMode, query } = req.body || {};
    const mode = queryMode ? "query" : "link";
    const rateLimit = enforceRateLimit(req, res, mode);
    if (!rateLimit.allowed) {
      metrics.rateLimited += 1;
      return res.status(429).json({
        ok: false,
        error: "muitas requisições, tente novamente em instantes"
      });
    }

    if (queryMode) {
      if (!query || typeof query !== "string" || !query.trim()) {
        return res.status(400).json({
          ok: false,
          error: "consulta inválida"
        });
      }

      if (!isQuerySafe(query)) {
        return res.status(400).json({
          ok: false,
          error: "consulta inválida ou muito longa"
        });
      }

      const fallbackByQuery = await buildSearchFallbackFromQuery(query.trim());
      if (fallbackByQuery.ok) {
        return res.status(200).json({ ok: true, data: fallbackByQuery.data });
      }

      return res.status(fallbackByQuery.status || 502).json({
        ok: false,
        error: fallbackByQuery.error || "não consegui pesquisar agora"
      });
    }

    if (!link || typeof link !== "string") {
      return res.status(400).json({
        ok: false,
        error: "link inválido"
      });
    }

    if (!isSupportedMusicLink(link)) {
      return res.status(400).json({
        ok: false,
        error: "link inválido ou não suportado"
      });
    }

    const sampleCacheKey = buildSampleCacheKey(link);
    if (sampleCacheKey) {
      const cachedResult = readSampleResultCache(sampleCacheKey);
      if (cachedResult) {
        return res.status(200).json({ ok: true, data: cachedResult });
      }
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

      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, mergedData, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return res.status(200).json({ ok: true, data: mergedData });
    }

    const fallbackResult = shouldUseSongLinkFirst
      ? await fetchPrimaryApi(link, adapters)
      : await fetchSongLinkAsFallback(link);

    if (fallbackResult.ok) {
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, fallbackResult.data, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return res.status(200).json({ ok: true, data: fallbackResult.data });
    }

    if (platform === "spotify") {
      const spotifyFallback = await buildSpotifySearchFallback(link);
      if (spotifyFallback.ok) {
        if (sampleCacheKey) {
          writeSampleResultCache(sampleCacheKey, spotifyFallback.data, SAMPLE_RESULT_CACHE_TTL_MS);
        }
        return res.status(200).json({ ok: true, data: spotifyFallback.data });
      }
    }

    return res.status(primaryResult.status || 502).json({
      ok: false,
      error: buildFriendlyPlatformError(platform, primaryResult.error || fallbackResult.error)
    });
  } catch (_error) {
    metrics.errors += 1;
    return res.status(500).json({
      ok: false,
      error: "erro interno ao converter"
    });
  } finally {
    releaseInFlightSlot();
  }
}

async function buildSpotifySearchFallback(link) {
  const normalizedLink = normalizeSpotifyUrl(link);
  const negativeCacheKey = `spotify:${normalizedLink}`;

  const cachedFailure = readCache(spotifyNegativeCache, negativeCacheKey);
  if (cachedFailure) return cachedFailure;

  const cachedByUrl = readCache(spotifyUrlCache, normalizedLink);
  if (cachedByUrl) return cachedByUrl;

  try {
    const metadata = await fetchSpotifyMetadata(link);
    if (!metadata?.title) {
      const failedResult = {
        ok: false,
        status: 404,
        error: "spotify metadata indisponível"
      };
      writeCache(spotifyNegativeCache, negativeCacheKey, failedResult, SPOTIFY_NEGATIVE_CACHE_TTL_MS);
      return failedResult;
    }

    const normalizedQuery = buildSpotifyQueryFromMetadata(metadata);
    if (!normalizedQuery.query) {
      const failedResult = {
        ok: false,
        status: 404,
        error: "query inválida para fallback spotify"
      };
      writeCache(spotifyNegativeCache, negativeCacheKey, failedResult, SPOTIFY_NEGATIVE_CACHE_TTL_MS);
      return failedResult;
    }

    const queryCacheKey = normalizeSearchText(normalizedQuery.query);
    const cachedByQuery = readCache(spotifyQueryCache, queryCacheKey);
    if (cachedByQuery) {
      const cachedWithCurrentSpotifyUrl = withCurrentSpotifyUrl(cachedByQuery, link);
      writeCache(spotifyUrlCache, normalizedLink, cachedWithCurrentSpotifyUrl, SPOTIFY_URL_CACHE_TTL_MS);
      return cachedWithCurrentSpotifyUrl;
    }

    const [appleMusicResult] = await Promise.all([
      fetchAppleMusicLinkFromItunes(normalizedQuery.query, normalizedQuery)
    ]);
    const baseLinks = buildSearchLinksFromQuery(normalizedQuery.query, link, appleMusicResult);
    const [songLinkFromApple, primaryFromApple] = appleMusicResult.url
      ? await Promise.all([
          fetchSongLink(appleMusicResult.url, { markVerified: true }),
          fetchPrimaryApi(appleMusicResult.url)
        ])
      : [{ ok: false }, { ok: false }];

    const songLinkMergedLinks = songLinkFromApple.ok
      ? mergeLinkResults({ links: baseLinks }, songLinkFromApple.data).links
      : baseLinks;

    const links = primaryFromApple.ok
      ? mergeLinkResults({ links: songLinkMergedLinks }, primaryFromApple.data).links
      : songLinkMergedLinks;

    if (!links.length) {
      const failedResult = {
        ok: false,
        status: 404,
        error: "nenhum link encontrado para fallback spotify"
      };
      writeCache(spotifyNegativeCache, negativeCacheKey, failedResult, SPOTIFY_NEGATIVE_CACHE_TTL_MS);
      return failedResult;
    }

    const metadataPayload = pickBestMetadata(
      { title: metadata.title, description: metadata.description || normalizedQuery.artist || "resultado por busca" },
      primaryFromApple.ok ? primaryFromApple.data : songLinkFromApple.ok ? songLinkFromApple.data : {},
      { image: metadata.image || "" }
    );

    const successResult = {
      ok: true,
      status: 200,
      data: {
        ...metadataPayload,
        links
      }
    };
    writeCache(spotifyUrlCache, normalizedLink, successResult, SPOTIFY_URL_CACHE_TTL_MS);
    writeCache(spotifyQueryCache, queryCacheKey, successResult, SPOTIFY_QUERY_CACHE_TTL_MS);
    deleteCache(spotifyNegativeCache, negativeCacheKey);

    return successResult;
  } catch (_error) {
    const failedResult = {
      ok: false,
      status: 502,
      error: "erro no fallback de spotify"
    };
    writeCache(spotifyNegativeCache, negativeCacheKey, failedResult, SPOTIFY_NEGATIVE_CACHE_TTL_MS);
    return failedResult;
  }
}

async function buildSearchFallbackFromQuery(query) {
  const normalizedQuery = buildSpotifyQueryFromMetadata({
    title: query,
    description: ""
  });

  if (!normalizedQuery.query) {
    return {
      ok: false,
      status: 400,
      error: "consulta inválida"
    };
  }

  const [appleMusicResult] = await Promise.all([
    fetchAppleMusicLinkFromItunes(normalizedQuery.query, normalizedQuery)
  ]);
  const baseLinks = buildSearchLinksFromQuery(normalizedQuery.query, "", appleMusicResult).filter(
    item => String(item.type || "").toLowerCase() !== "spotify"
  );

  const [songLinkFromApple, primaryFromApple] = appleMusicResult.url
    ? await Promise.all([
        fetchSongLink(appleMusicResult.url, { markVerified: true }),
        fetchPrimaryApi(appleMusicResult.url)
      ])
    : [{ ok: false }, { ok: false }];

  const songLinkMergedLinks = songLinkFromApple.ok
    ? mergeLinkResults({ links: baseLinks }, songLinkFromApple.data).links
    : baseLinks;

  const links = primaryFromApple.ok
    ? mergeLinkResults({ links: songLinkMergedLinks }, primaryFromApple.data).links
    : songLinkMergedLinks;

  if (!links.length) {
    return {
      ok: false,
      status: 404,
      error: "nenhum resultado encontrado"
    };
  }

  const metadataPayload = pickBestMetadata(
    {
      title: normalizedQuery.title || query,
      description: normalizedQuery.artist || ""
    },
    primaryFromApple.ok ? primaryFromApple.data : songLinkFromApple.ok ? songLinkFromApple.data : {}
  );

  return {
    ok: true,
    status: 200,
    data: {
      ...metadataPayload,
      links
    }
  };
}

function normalizeSpotifyUrl(link) {
  try {
    const parsed = new URL(String(link || ""));
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch (_error) {
    return String(link || "").trim();
  }
}

function normalizeSampleLink(link) {
  try {
    const parsed = new URL(String(link || "").trim());
    parsed.hash = "";
    return parsed.toString();
  } catch (_error) {
    return String(link || "").trim();
  }
}

function buildSampleCacheKey(link) {
  const normalized = normalizeSampleLink(link);
  if (!SAMPLE_CACHEABLE_LINKS.has(normalized)) return null;
  return `sample:${normalized}`;
}

function readSampleResultCache(key) {
  const entry = sampleResultCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    sampleResultCache.delete(key);
    return null;
  }
  return cloneJson(entry.value);
}

function writeSampleResultCache(key, value, ttlMs) {
  sampleResultCache.set(key, {
    value: cloneJson(value),
    expiresAt: Date.now() + ttlMs
  });
}

function withCurrentSpotifyUrl(result, spotifyUrl) {
  const cloned = cloneJson(result);
  if (!cloned?.data?.links?.length) return cloned;

  cloned.data.links = cloned.data.links.map(item =>
    String(item?.type || "").toLowerCase() === "spotify"
      ? {
          ...item,
          url: spotifyUrl,
          isVerified: true
        }
      : item
  );

  return cloned;
}

function readCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) {
    metrics.spotifyCacheMiss += 1;
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    metrics.spotifyCacheMiss += 1;
    return null;
  }

  metrics.spotifyCacheHit += 1;
  return cloneJson(entry.value);
}

function writeCache(cache, key, value, ttlMs) {
  cache.set(key, {
    value: cloneJson(value),
    expiresAt: Date.now() + ttlMs
  });
}

function deleteCache(cache, key) {
  cache.delete(key);
}

function enforceRateLimit(req, res, mode = "link") {
  const now = Date.now();
  const key = resolveRateLimitKey(req);
  const current = requestRateLimitStore.get(key) || {
    short: { count: 0, resetAt: now + RATE_LIMIT_SHORT_WINDOW_MS },
    long: { count: 0, resetAt: now + RATE_LIMIT_LONG_WINDOW_MS },
    strikes: 0,
    blockedUntil: 0
  };

  if (current.blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.blockedUntil - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("X-RateLimit-Remaining", "0");
    return { allowed: false };
  }

  if (current.short.resetAt <= now) current.short = { count: 0, resetAt: now + RATE_LIMIT_SHORT_WINDOW_MS };
  if (current.long.resetAt <= now) current.long = { count: 0, resetAt: now + RATE_LIMIT_LONG_WINDOW_MS };

  const limits = mode === "query"
    ? { short: RATE_LIMIT_QUERY_SHORT_MAX, long: RATE_LIMIT_QUERY_LONG_MAX }
    : { short: RATE_LIMIT_LINK_SHORT_MAX, long: RATE_LIMIT_LINK_LONG_MAX };

  if (current.short.count >= limits.short || current.long.count >= limits.long) {
    current.strikes += 1;
    if (current.strikes >= RATE_LIMIT_STRIKES_BEFORE_BLOCK) {
      current.blockedUntil = now + RATE_LIMIT_BLOCK_MS;
      current.strikes = 0;
    }
    requestRateLimitStore.set(key, current);
    const retryAt = current.blockedUntil > now ? current.blockedUntil : Math.min(current.short.resetAt, current.long.resetAt);
    const retryAfterSeconds = Math.max(1, Math.ceil((retryAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("X-RateLimit-Limit", String(limits.long));
    res.setHeader("X-RateLimit-Remaining", "0");
    return { allowed: false };
  }

  current.short.count += 1;
  current.long.count += 1;
  requestRateLimitStore.set(key, current);
  res.setHeader("X-RateLimit-Limit", String(limits.long));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limits.long - current.long.count)));
  return { allowed: true };
}

function resolveRateLimitKey(req) {
  const ip =
    String(req.headers?.["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    "unknown-ip";
  const apiKey = String(req.headers?.["x-api-key"] || "anon").trim();
  const userAgent = String(req.headers?.["user-agent"] || "").slice(0, 120);
  return `${ip}|${apiKey}|${userAgent}`;
}

function acquireInFlightSlot() {
  if (inFlightRequests >= MAX_IN_FLIGHT_REQUESTS) return false;
  inFlightRequests += 1;
  return true;
}

function releaseInFlightSlot() {
  inFlightRequests = Math.max(0, inFlightRequests - 1);
}

function isQuerySafe(query) {
  const normalized = String(query || "").trim();
  if (!normalized || normalized.length > MAX_QUERY_LENGTH) return false;
  if (/([a-z0-9])\1{8,}/i.test(normalized)) return false;
  if (!/[a-z0-9]/i.test(normalized)) return false;
  return true;
}

function isSupportedMusicLink(link) {
  const normalized = String(link || "").trim();
  if (!normalized || normalized.length > MAX_LINK_LENGTH) return false;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch (_error) {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  const supportedHosts = [
    "spotify.com",
    "open.spotify.com",
    "music.apple.com",
    "itunes.apple.com",
    "youtube.com",
    "youtu.be",
    "music.youtube.com",
    "deezer.com",
    "soundcloud.com",
    "tidal.com",
    "qobuz.com",
    "pandora.com",
    "music.amazon.com",
    "amazon.com"
  ];

  return supportedHosts.some(item => host === item || host.endsWith(`.${item}`));
}

let nextMetricsLogAt = Date.now() + 60_000;

function emitMetricsHeartbeat() {
  const now = Date.now();
  if (now < nextMetricsLogAt) return;

  nextMetricsLogAt = now + 60_000;
  console.log(
    JSON.stringify({
      scope: "api.convert",
      metrics,
      timestamp: new Date(now).toISOString()
    })
  );
}

function logProviderError(provider, status, message) {
  console.warn(
    JSON.stringify({
      scope: "api.convert.provider_error",
      provider,
      status,
      message: String(message || "unknown_error")
    })
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSpotifyMetadata(link) {
  const ogMetadata = await tryFetchSpotifyMetadataFromOg(link);
  if (ogMetadata?.title) {
    return ogMetadata;
  }

  return fetchSpotifyMetadataFromOEmbed(link);
}

async function tryFetchSpotifyMetadataFromOg(link) {
  try {
    return await fetchSpotifyMetadataFromOg(link);
  } catch (_error) {
    return {
      title: "",
      description: "",
      image: "",
      type: ""
    };
  }
}

async function fetchSpotifyMetadataFromOg(link) {
  const response = await fetchWithTimeout(link, {
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

async function fetchSpotifyMetadataFromOEmbed(link) {
  const response = await fetchWithTimeout(`${SPOTIFY_OEMBED_API_URL}?url=${encodeURIComponent(link)}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("spotify oembed indisponível");
  }

  const payload = await response.json();
  const { title, artist } = parseSpotifyOEmbedTitle(payload?.title || "");

  return {
    title,
    description: artist ? `${artist} · Spotify` : "",
    image: payload?.thumbnail_url || "",
    type: payload?.type || ""
  };
}

function parseSpotifyOEmbedTitle(value) {
  const raw = String(value || "").trim();
  if (!raw) return { title: "", artist: "" };

  const index = raw.toLowerCase().lastIndexOf(" by ");
  if (index === -1) {
    return { title: raw, artist: "" };
  }

  return {
    title: raw.slice(0, index).trim(),
    artist: raw.slice(index + 4).trim()
  };
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
  if (!query) return { url: "", isVerified: false };

  try {
    const response = await fetchWithTimeout(
      `${ITUNES_SEARCH_API_URL}?term=${encodeURIComponent(query)}&entity=song&limit=5`
    );

    if (!response.ok) return { url: "", isVerified: false };

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return { url: "", isVerified: false };

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

    return {
      url: target?.candidate?.trackViewUrl || "",
      isVerified: target.score >= 85
    };
  } catch (_error) {
    return { url: "", isVerified: false };
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

  if (best) {
    return { candidate: best, score: bestScore };
  }

  return {
    candidate: candidates[0] || null,
    score: 0
  };
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

function buildSearchLinksFromQuery(query, originalSpotifyUrl, appleMusicResult) {
  const encoded = encodeURIComponent(query);
  const appleMusicUrl = appleMusicResult?.url || "";
  const appleMusicIsVerified = Boolean(appleMusicResult?.isVerified);

  const links = [
    {
      type: "spotify",
      url: originalSpotifyUrl,
      isVerified: true
    },
    appleMusicUrl
      ? {
          type: "appleMusic",
          url: appleMusicUrl,
          isVerified: appleMusicIsVerified
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

function pickBestMetadata(baseData, enrichedData, fallback = {}) {
  const base = baseData || {};
  const enriched = enrichedData || {};
  return {
    title: enriched.title || base.title || fallback.title || "música encontrada",
    description: enriched.description || base.description || fallback.description || "",
    album: enriched.album || base.album || fallback.album || "",
    image: enriched.image || base.image || fallback.image || "",
    universalLink: enriched.universalLink || base.universalLink || fallback.universalLink || ""
  };
}

async function fetchPrimaryApi(link, adapters) {
  try {
    const upstream = await fetchWithTimeout(PRIMARY_API_URL, {
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
      metrics.errors += 1;
      logProviderError("primary_api", upstream.status, upstreamMessage);

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
    metrics.errors += 1;
    logProviderError("primary_api", 502, "network_error");
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
    const upstream = await fetchWithTimeout(`${SONGLINK_API_URL}?url=${encodeURIComponent(link)}`);
    const data = await upstream.json();

    if (!upstream.ok) {
      metrics.errors += 1;
      logProviderError("songlink", upstream.status, data?.message || data?.error || "upstream_error");
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
    metrics.errors += 1;
    logProviderError("songlink", 502, "network_error");
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
    const existingIsSearch = isSearchLikeUrl(existing?.url, key);
    const incomingIsSearch = isSearchLikeUrl(item?.url, key);

    if (existingIsSearch && !incomingIsSearch) {
      byType.set(key, {
        ...item,
        isVerified: Boolean(item?.isVerified)
      });
      continue;
    }

    if (!existingIsSearch && incomingIsSearch) {
      byType.set(key, {
        ...existing,
        isVerified: Boolean(existing?.isVerified)
      });
      continue;
    }

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

function isSearchLikeUrl(url, type = "") {
  const lower = String(url || "").toLowerCase();
  const key = String(type || "").toLowerCase();

  if (!lower) return false;
  if (key === "youtube" || key === "youtubeMusic".toLowerCase()) {
    return lower.includes("search_query=") || lower.includes("/search");
  }
  if (key === "deezer") return lower.includes("deezer.com/search");
  if (key === "soundcloud") return lower.includes("soundcloud.com/search");
  if (key === "tidal") return lower.includes("tidal.com/search");
  if (key === "qobuz") return lower.includes("qobuz.com") && lower.includes("/search");
  if (key === "amazonmusic" || key === "amazonstore") return lower.includes("music.amazon.com/search");
  if (key === "applemusic" || key === "itunes") return lower.includes("music.apple.com") && lower.includes("/search");

  return /[?&](q|query|search_query|term)=/.test(lower) && lower.includes("search");
}
