const PRIMARY_API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";
const SONGLINK_API_URL = "https://api.song.link/v1-alpha.1/links";
const ITUNES_SEARCH_API_URL = "https://itunes.apple.com/search";
const SPOTIFY_OEMBED_API_URL = "https://open.spotify.com/oembed";
const SPOTIFY_WEB_TOKEN_URL = "https://open.spotify.com/get_access_token?reason=transport&productType=web-player";
const SPOTIFY_GRAPHQL_SEARCH_URL = "https://api-partner.spotify.com/pathfinder/v1/query";
const SPOTIFY_SEARCH_DESKTOP_SHA256 = "6f9f0dce89a5b6a8d613f9aef0f31e0f48f0506c7e8f3f95f8ed3d6f1e1c9a44";
const DEEZER_OEMBED_API_URL = "https://www.deezer.com/oembed";
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
const MAX_METADATA_TEXT_LENGTH = 200;
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
const SAMPLE_CACHEABLE_IDENTITIES = new Set(
  Array.from(SAMPLE_CACHEABLE_LINKS).map(buildSampleLinkIdentity)
);

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
    if (platform === "spotify") {
      const spotifyInputResult = await buildSpotifyInputResolution(link);
      if (spotifyInputResult.ok) {
        const finalizedData = await finalizeResultData(spotifyInputResult.data);
        if (sampleCacheKey) {
          writeSampleResultCache(sampleCacheKey, finalizedData, SAMPLE_RESULT_CACHE_TTL_MS);
        }
        return res.status(200).json({ ok: true, data: finalizedData });
      }
    }

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

      const groundedData = await enforceInputTrackGroundTruth(mergedData, link);
      const finalizedData = await finalizeResultData(groundedData);
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, finalizedData, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return res.status(200).json({ ok: true, data: finalizedData });
    }

    const fallbackResult = shouldUseSongLinkFirst
      ? await fetchPrimaryApi(link, adapters)
      : await fetchSongLinkAsFallback(link);

    if (fallbackResult.ok) {
      const groundedData = await enforceInputTrackGroundTruth(fallbackResult.data, link);
      const finalizedData = await finalizeResultData(groundedData);
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, finalizedData, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return res.status(200).json({ ok: true, data: finalizedData });
    }

    if (platform === "spotify") {
      const spotifyFallback = await buildSpotifySearchFallback(link);
      if (spotifyFallback.ok) {
        const groundedData = await enforceInputTrackGroundTruth(spotifyFallback.data, link);
        const finalizedData = await finalizeResultData(groundedData);
        if (sampleCacheKey) {
          writeSampleResultCache(sampleCacheKey, finalizedData, SAMPLE_RESULT_CACHE_TTL_MS);
        }
        return res.status(200).json({ ok: true, data: finalizedData });
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

    const queryCacheKey = buildSpotifyIdentityCacheKey({
      type: "query",
      title: normalizedQuery.title,
      artist: normalizedQuery.artist
    });
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
    const [songLinkFromApple] = appleMusicResult.url
      ? await Promise.all([
          fetchSongLink(appleMusicResult.url, { markVerified: true, protectVerified: true })
        ])
      : [{ ok: false }];

    const songLinkMergedLinks = songLinkFromApple.ok
      ? mergeLinkResults({ links: baseLinks }, songLinkFromApple.data).links
      : baseLinks;

    const links = songLinkMergedLinks;

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
      songLinkFromApple.ok ? songLinkFromApple.data : {},
      { image: metadata.image || "" }
    );

    const successResult = {
      ok: true,
      status: 200,
      data: await finalizeResultData({
        ...metadataPayload,
        links
      })
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

async function buildSpotifyInputResolution(link) {
  const spotifyUrl = canonicalizeMediaUrl(link);
  const metadata = await fetchSpotifyMetadata(link);
  const spotifyQuery = buildSpotifyQueryFromMetadata(metadata);
  const anchoredArtist = await resolveAnchoredSpotifyInputArtist(link, metadata);
  const anchoredTitle = resolveAnchoredSpotifyInputTitle(metadata, spotifyQuery);

  const appleMusicResult = await fetchAppleMusicLinkFromItunes(spotifyQuery.query, spotifyQuery);
  const links = [
    {
      type: "spotify",
      url: spotifyUrl,
      isVerified: true,
      isProtected: true,
      source: "input"
    }
  ];

  if (appleMusicResult?.url) {
    links.push({
      type: "appleMusic",
      url: canonicalizeMediaUrl(appleMusicResult.url),
      isVerified: Boolean(appleMusicResult.isVerified),
      isProtected: Boolean(appleMusicResult.isVerified),
      source: "itunes_lookup"
    });
  }

  let mergedLinks = dedupeAndNormalizeLinks(links);
  if (appleMusicResult?.url) {
    const songLinkFromApple = await fetchSongLink(appleMusicResult.url, {
      markVerified: true,
      protectVerified: true
    });
    if (songLinkFromApple.ok) {
      mergedLinks = mergeLinkResults({ links: mergedLinks }, songLinkFromApple.data).links;
    }
  }

  const metadataPayload = pickBestMetadata(
    {
      title: anchoredTitle || "música encontrada",
      description: anchoredArtist || "",
      image: metadata?.image || ""
    },
    {},
    {}
  );

  return {
    ok: true,
    status: 200,
    data: {
      ...metadataPayload,
      _lockArtist: true,
      links: mergedLinks
    }
  };
}

async function resolveAnchoredSpotifyInputArtist(link, metadata) {
  try {
    const oembed = await fetchSpotifyMetadataFromOEmbed(link);
    const oembedQuery = buildSpotifyQueryFromMetadata(oembed);
    if (oembedQuery.artist) return oembedQuery.artist;
  } catch (_error) {
    // no-op
  }

  const query = buildSpotifyQueryFromMetadata(metadata);
  return query.artist || "";
}

function resolveAnchoredSpotifyInputTitle(metadata, spotifyQuery) {
  if (spotifyQuery?.title) return spotifyQuery.title;
  const fallback = buildSpotifyQueryFromMetadata(metadata);
  return fallback.title || "";
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
  const relaxedQuery = buildRelaxedMusicSearchQuery(query);
  const relaxedAppleMusicResult =
    !appleMusicResult?.url && relaxedQuery && relaxedQuery !== normalizedQuery.query
      ? await fetchAppleMusicLinkFromItunes(relaxedQuery, {
          title: relaxedQuery,
          artist: "",
          query: relaxedQuery
        })
      : null;
  const bestAppleMusicResult = appleMusicResult?.url ? appleMusicResult : relaxedAppleMusicResult || appleMusicResult;
  const baseLinks = buildSearchLinksFromQuery(normalizedQuery.query, "", bestAppleMusicResult).filter(
    item => String(item.type || "").toLowerCase() !== "spotify"
  );

  const [songLinkFromApple] = bestAppleMusicResult?.url
    ? await Promise.all([
        fetchSongLink(bestAppleMusicResult.url, { markVerified: true, protectVerified: true })
      ])
    : [{ ok: false }];

  const songLinkMergedLinks = songLinkFromApple.ok
    ? mergeLinkResults({ links: baseLinks }, songLinkFromApple.data).links
    : baseLinks;

  const links = songLinkMergedLinks;

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
    songLinkFromApple.ok ? songLinkFromApple.data : {}
  );

  return {
    ok: true,
    status: 200,
    data: await finalizeResultData({
      ...metadataPayload,
      links
    })
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

function buildSpotifyIdentityCacheKey({ type = "track", title = "", artist = "", spotifyId = "", appleTrackId = "" } = {}) {
  const parts = [
    String(type || "track").toLowerCase(),
    normalizeSearchText(title),
    normalizeSearchText(artist),
    String(spotifyId || "").trim().toLowerCase(),
    String(appleTrackId || "").trim().toLowerCase()
  ].filter(Boolean);
  return parts.join("|");
}

function normalizeSampleLink(link) {
  try {
    const parsed = new URL(String(link || "").trim());
    const host = parsed.hostname.toLowerCase();
    if (host.includes("music.apple.com")) {
      const trackId = parsed.searchParams.get("i");
      parsed.search = "";
      if (trackId) {
        parsed.searchParams.set("i", trackId);
      }
    }

    parsed.hash = "";
    return parsed.toString();
  } catch (_error) {
    return String(link || "").trim();
  }
}

function buildSampleLinkIdentity(normalizedLink) {
  try {
    const parsed = new URL(String(normalizedLink || "").trim());
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("music.apple.com")) return parsed.toString();

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const albumId = pathSegments[pathSegments.length - 1] || "";
    const trackId = parsed.searchParams.get("i") || "";

    if (albumId && trackId) return `applemusic:track:${albumId}:${trackId}`;
    if (trackId) return `applemusic:track:${trackId}`;

    return parsed.toString();
  } catch (_error) {
    return String(normalizedLink || "").trim();
  }
}

function buildSampleCacheKey(link) {
  const normalized = normalizeSampleLink(link);
  const identity = buildSampleLinkIdentity(normalized);
  if (!SAMPLE_CACHEABLE_IDENTITIES.has(identity)) return null;
  return `sample:${identity}`;
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

  const artist = extractSpotifyArtistFromMetadata({
    description: metadata?.description || "",
    title: metadata?.title || ""
  });

  return {
    title,
    artist,
    query: [title, artist].filter(Boolean).join(" ").trim()
  };
}

function extractSpotifyArtistFromMetadata({ description = "", title = "" } = {}) {
  const rawDescription = String(description || "").trim();
  const rawTitle = String(title || "").trim();

  const byMatch = rawDescription.match(/\bby\s+(.+?)(?:\s*\||$)/i) || rawTitle.match(/\bby\s+(.+?)(?:\s*\||$)/i);
  if (byMatch?.[1]) return sanitizeSpotifyArtistToken(byMatch[1]);

  const parts = rawDescription
    .split("·")
    .map(item => sanitizeSpotifyArtistToken(item))
    .filter(Boolean)
    .filter(item => !isGenericSpotifyDescriptor(item));

  if (parts.length >= 2) {
    return parts[0] === "spotify" ? parts[1] : parts[0];
  }
  if (parts.length === 1) return parts[0];

  return "";
}

function sanitizeSpotifyArtistToken(value) {
  return String(value || "")
    .replace(/\|\s*spotify$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericSpotifyDescriptor(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return true;
  const blocked = new Set(["song", "single", "album", "ep", "spotify", "artist"]);
  return blocked.has(normalized);
}

async function fetchAppleMusicLinkFromItunes(query, normalizedQuery) {
  if (!query) return { url: "", isVerified: false, artist: "", title: "", album: "" };

  try {
    const response = await fetchWithTimeout(
      `${ITUNES_SEARCH_API_URL}?term=${encodeURIComponent(query)}&entity=song&limit=5`
    );

    if (!response.ok) return { url: "", isVerified: false, artist: "", title: "", album: "" };

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return { url: "", isVerified: false, artist: "", title: "", album: "" };

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
      isVerified: target.score >= 85,
      artist: target?.candidate?.artistName || "",
      title: target?.candidate?.trackName || "",
      album: target?.candidate?.collectionName || ""
    };
  } catch (_error) {
    return { url: "", isVerified: false, artist: "", title: "", album: "" };
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

function buildRelaxedMusicSearchQuery(value) {
  return String(value || "")
    .replace(/[&/+|]+/g, " ")
    .replace(/[“”"']/g, " ")
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
          isVerified: appleMusicIsVerified,
          isProtected: appleMusicIsVerified,
          source: "itunes_lookup"
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

async function finalizeResultData(data) {
  const payload = data || {};
  const normalizedLinks = dedupeAndNormalizeLinks(Array.isArray(payload.links) ? payload.links : []);
  const youtubeAdjustedLinks = refineYoutubePlatformsWithCandidates(normalizedLinks, payload);
  const imageFromLinks = pickImageFromLinks(normalizedLinks);
  const base = {
    ...payload,
    title: sanitizeMetadataText(payload.title, MAX_METADATA_TEXT_LENGTH) || "música encontrada",
    description: sanitizeMetadataText(payload.description, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }),
    album: sanitizeMetadataText(payload.album, MAX_METADATA_TEXT_LENGTH),
    image: payload.image || imageFromLinks || "",
    links: youtubeAdjustedLinks
  };

  const spotifyEnriched = await enrichWithSpotifyFallback(base);
  const secondaryEnriched = await enrichWithSecondaryFallbacks(spotifyEnriched);
  const bridgeEnriched = await enrichWithAppleBridgeFallback(secondaryEnriched);
  const { _lockArtist, ...publicPayload } = bridgeEnriched || {};
  return publicPayload;
}

function refineYoutubePlatformsWithCandidates(links, payload) {
  const nextLinks = Array.isArray(links) ? links.map(item => ({ ...item })) : [];
  if (!nextLinks.length) return nextLinks;

  const originalContext = buildOriginalTrackContext(payload);
  const youtubeTypes = ["youtube", "youtubemusic"];

  for (const platformKey of youtubeTypes) {
    const platformLinks = nextLinks.filter(item => String(item?.type || "").toLowerCase() === platformKey);
    if (!platformLinks.length) continue;

    const replacement = resolveYoutubePlatformLink(platformLinks, platformKey, originalContext);
    if (!replacement) continue;

    const idx = nextLinks.findIndex(item => String(item?.type || "").toLowerCase() === platformKey);
    if (idx !== -1) nextLinks[idx] = replacement;
  }

  return nextLinks;
}

function resolveYoutubePlatformLink(candidates, platformKey, context) {
  const classified = classifyYoutubeLinks(candidates, platformKey, context);
  if (!classified.length) return null;

  const chosen = chooseYoutubeCandidate(classified);
  if (!chosen) return null;

  return maybeRecoverYoutubeLinks(chosen, platformKey, context);
}

function buildOriginalTrackContext(payload) {
  const title = String(payload?.title || "").trim();
  const artist = extractArtistFromPayload(payload);
  const query = [title, artist].filter(Boolean).join(" ").trim();
  const qualifiers = getTrackQualifiers(`${title} ${artist}`);
  const titleTokens = toQueryTokens(title);
  const artistTokens = toQueryTokens(artist);
  const durationMs = Number(payload?.durationMs || payload?.duration || 0) || 0;
  const isrc = String(payload?.isrc || "").trim().toUpperCase();

  return { title, artist, query, qualifiers, titleTokens, artistTokens, durationMs, isrc };
}

function classifyYoutubeLinks(candidates, platformKey, context) {
  return (Array.isArray(candidates) ? candidates : []).map((candidate, index) => {
    const url = String(candidate?.url || "");
    const lower = url.toLowerCase();
    const metadataText = buildYoutubeCandidateHintText(candidate);
    const isSearch = isSearchLikeUrl(url, platformKey);
    const hasDirectVideo = Boolean(getYoutubeVideoId(url));
    const semanticSignals = collectYoutubeSemanticSignals(platformKey, metadataText);
    let score = 0;

    if (!isSearch && hasDirectVideo) score += 42;
    if (isSearch) score -= 35;
    if (candidate?.isVerified) score += 20;
    if (index === 0) score += 12;
    if (index === 0 && !isSearch && hasDirectVideo) score += 10;
    score += semanticSignals.score;

    if (platformKey === "youtubemusic") {
      if (lower.includes("music.youtube.com")) score += 8;
    } else {
      if (lower.includes("youtube.com/watch")) score += 8;
    }

    const candidateQualifiers = getTrackQualifiers(metadataText);
    const qualifierDelta = scoreQualifierAlignment(context?.qualifiers || new Set(), candidateQualifiers);
    score += qualifierDelta;

    const metadataAlignment = scoreMetadataAlignment(context, metadataText);
    score += metadataAlignment;

    if (context?.durationMs > 0 && Number(candidate?.durationMs || 0) > 0) {
      const diff = Math.abs(Number(candidate.durationMs) - context.durationMs);
      if (diff <= 2000) {
        score += platformKey === "youtubemusic" ? 16 : 6;
      } else if (diff > 8000) {
        score -= platformKey === "youtubemusic" ? 12 : 4;
      }
    }

    if (context?.isrc && String(candidate?.isrc || "").toUpperCase() === context.isrc) {
      score += 14;
    }

    return {
      ...candidate,
      _youtubeScore: score,
      _youtubeSearchOnly: isSearch || !hasDirectVideo,
      _youtubeSemanticSignals: semanticSignals.matchedSignals,
      _youtubeProviderLeadCandidate: index === 0 && !isSearch,
      _youtubeHasStrongAnchor:
        Boolean(candidate?.isVerified) ||
        (context?.isrc && String(candidate?.isrc || "").toUpperCase() === context.isrc) ||
        (context?.durationMs > 0 &&
          Number(candidate?.durationMs || 0) > 0 &&
          Math.abs(Number(candidate.durationMs) - context.durationMs) <= 2000)
    };
  });
}

function chooseYoutubeCandidate(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null;
  let best = candidates[0];
  for (const current of candidates) {
    if ((current?._youtubeScore || 0) > (best?._youtubeScore || 0)) {
      best = current;
    }
  }
  return best;
}

function maybeRecoverYoutubeLinks(candidate, platformKey, context) {
  if (!candidate?.url) return null;
  const score = Number(candidate._youtubeScore || 0);
  const searchFallbackUrl = buildYoutubeSearchFallbackUrl(platformKey, context);
  const semanticSignals = Number(candidate._youtubeSemanticSignals || 0);
  const hasStrongAnchor = Boolean(candidate._youtubeHasStrongAnchor);
  const isProviderLeadCandidate = Boolean(candidate._youtubeProviderLeadCandidate);

  if (!candidate._youtubeSearchOnly && score >= 78 && semanticSignals >= 2 && hasStrongAnchor) {
    return {
      type: platformKey === "youtubemusic" ? "youtubeMusic" : "youtube",
      url: canonicalizeMediaUrl(candidate.url),
      isVerified: true
    };
  }

  if (!candidate._youtubeSearchOnly && score >= 20) {
    const {
      _youtubeScore,
      _youtubeSearchOnly,
      _youtubeSemanticSignals,
      _youtubeHasStrongAnchor,
      _youtubeProviderLeadCandidate,
      ...cleanCandidate
    } = candidate;
    return {
      ...cleanCandidate,
      type: platformKey === "youtubemusic" ? "youtubeMusic" : "youtube",
      url: canonicalizeMediaUrl(candidate.url),
      isVerified: Boolean(candidate?.isVerified)
    };
  }

  if (!candidate._youtubeSearchOnly && isProviderLeadCandidate && score >= 8) {
    return {
      type: platformKey === "youtubemusic" ? "youtubeMusic" : "youtube",
      url: canonicalizeMediaUrl(candidate.url),
      isVerified: Boolean(candidate?.isVerified)
    };
  }

  return {
    type: platformKey === "youtubemusic" ? "youtubeMusic" : "youtube",
    url: searchFallbackUrl || candidate.url,
    isVerified: false
  };
}

function buildYoutubeSearchFallbackUrl(platformKey, context) {
  const query = normalizeSearchText(context?.query || "").trim();
  if (!query) return "";
  const suffix =
    platformKey === "youtubemusic" ? "" : " official music video";
  const encoded = encodeURIComponent(`${query}${suffix}`.trim());
  return platformKey === "youtubemusic"
    ? `https://music.youtube.com/search?q=${encoded}`
    : `https://www.youtube.com/results?search_query=${encoded}`;
}

function getTrackQualifiers(value) {
  const text = normalizeSearchText(value);
  const qualifiers = new Set();
  const known = ["live", "acoustic", "remix", "instrumental", "demo", "session", "karaoke", "edit"];
  for (const term of known) {
    if (text.includes(term)) qualifiers.add(term);
  }
  return qualifiers;
}

function scoreQualifierAlignment(sourceQualifiers, candidateQualifiers) {
  if (!sourceQualifiers.size && !candidateQualifiers.size) return 0;
  let score = 0;
  for (const q of sourceQualifiers) {
    score += candidateQualifiers.has(q) ? 4 : -2;
  }
  for (const q of candidateQualifiers) {
    if (!sourceQualifiers.has(q)) score -= 3;
  }
  return score;
}

function extractArtistFromPayload(payload) {
  const directArtist = String(payload?.artist || payload?.artistName || "").trim();
  if (directArtist) return directArtist;

  const description = String(payload?.description || "").trim();
  if (!description) return "";

  const firstChunk = description
    .split(/•|\||-|\n/)
    .map(item => item.trim())
    .find(Boolean);

  if (!firstChunk) return "";
  if (isNoisyMetadataText(normalizeSearchText(firstChunk))) return "";
  return firstChunk;
}

function buildYoutubeCandidateHintText(candidate) {
  const parts = [
    candidate?.title,
    candidate?.name,
    candidate?.trackName,
    candidate?.artistName,
    candidate?.description,
    candidate?.channel,
    candidate?.channelTitle,
    candidate?.authorName,
    candidate?.uploader,
    candidate?.url
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean);

  return normalizeSearchText(parts.join(" "));
}

function collectYoutubeSemanticSignals(platformKey, hintText) {
  const text = normalizeSearchText(hintText || "");
  let score = 0;
  let matchedSignals = 0;

  const hasToken = token => text.includes(token);
  const register = (condition, points) => {
    if (!condition) return;
    score += points;
    matchedSignals += 1;
  };

  if (platformKey === "youtubemusic") {
    register(hasToken("topic") || hasToken("tema"), 10);
    register(hasToken("auto generated by youtube") || hasToken("provided to youtube by"), 10);
    register(hasToken("art track"), 8);
    register(hasToken("official audio"), 8);
    if (hasToken("official music video") || hasToken("official video") || hasToken("vevo")) {
      score -= 10;
    }
  } else {
    register(hasToken("official music video"), 12);
    register(hasToken("official video"), 10);
    register(hasToken("vevo"), 8);
    register(hasToken("lyric video"), 4);
    if (hasToken("art track") || hasToken("topic") || hasToken("auto generated by youtube")) {
      score -= 8;
    }
  }

  return { score, matchedSignals };
}

function scoreMetadataAlignment(context, hintText) {
  const text = normalizeSearchText(hintText || "");
  if (!text) return 0;

  const titleTokens = Array.isArray(context?.titleTokens) ? context.titleTokens : [];
  const artistTokens = Array.isArray(context?.artistTokens) ? context.artistTokens : [];
  let score = 0;

  const titleMatches = titleTokens.filter(token => text.includes(token)).length;
  const artistMatches = artistTokens.filter(token => text.includes(token)).length;

  if (titleTokens.length) {
    const ratio = titleMatches / titleTokens.length;
    if (ratio >= 0.8) score += 18;
    else if (ratio >= 0.5) score += 10;
    else score -= 10;
  }

  if (artistTokens.length) {
    const ratio = artistMatches / artistTokens.length;
    if (ratio >= 0.8) score += 14;
    else if (ratio >= 0.5) score += 8;
    else score -= 8;
  }

  return score;
}

async function enrichWithAppleBridgeFallback(data) {
  const next = { ...(data || {}) };
  const links = Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : [];
  if (!links.length) return next;

  const presentKeys = new Set(links.map(item => String(item?.type || "").toLowerCase()));
  const requiresBridge = ["tidal", "amazonmusic", "qobuz", "pandora", "soundcloud", "spotify"].some(
    key => !presentKeys.has(key)
  );
  if (!requiresBridge) return next;

  const appleEntry = links.find(item => {
    const type = String(item?.type || "").toLowerCase();
    if (type !== "applemusic" && type !== "itunes") return false;
    if (!item?.url) return false;
    return !isSearchLikeUrl(item.url, type);
  });
  if (!appleEntry?.url) return maybeInjectSpotifySearchFallback(next, links);

  let mergedLinks = links;
  const appleUrl = canonicalizeMediaUrl(appleEntry.url);

  try {
    const [songLinkFromApple] = await Promise.all([
      fetchSongLink(appleUrl, { markVerified: true, protectVerified: true })
    ]);

    if (songLinkFromApple.ok) {
      mergedLinks = mergeLinkResults({ links: mergedLinks }, songLinkFromApple.data).links;
    }
  } catch (_error) {
    return maybeInjectSpotifySearchFallback(next, mergedLinks);
  }

  return maybeInjectSpotifySearchFallback(next, mergedLinks);
}

async function maybeInjectSpotifySearchFallback(data, links) {
  const nextLinks = Array.isArray(links) ? links.map(item => ({ ...item })) : [];
  const hasSpotify = nextLinks.some(item => String(item?.type || "").toLowerCase() === "spotify");
  if (!hasSpotify) {
    const expectedMetadata = extractExpectedTrackMetadata(data);
    const spotifyTrack = await searchSpotifyTrackDirect(expectedMetadata.query, expectedMetadata);
    if (spotifyTrack?.url) {
      nextLinks.push({
        type: "spotify",
        url: spotifyTrack.url,
        isVerified: true,
        source: "spotify_direct_search"
      });
    } else {
      const spotifySearchUrl = buildSpotifySearchUrlFromResult(data);
      if (spotifySearchUrl) {
        nextLinks.push({
          type: "spotify",
          url: spotifySearchUrl,
          isVerified: false
        });
      }
    }
  }

  return {
    ...data,
    links: dedupeAndNormalizeLinks(nextLinks)
  };
}

function buildSpotifySearchUrlFromResult(data) {
  const title = String(data?.title || "").trim();
  const description = String(data?.description || "").split("•")[0].trim();
  const query = [title, description].filter(Boolean).join(" ").trim();
  if (!query) return "";
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

function extractExpectedTrackMetadata(data) {
  const title = String(data?.title || "").trim();
  const description = String(data?.description || "").trim();
  const artist = description.split("•")[0].trim();
  const query = [title, artist].filter(Boolean).join(" ").trim();
  return { title, artist, query };
}

async function searchSpotifyTrackDirect(query, expectedMetadata = {}) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) return null;

  try {
    const accessToken = await fetchSpotifyAnonymousToken();
    if (!accessToken) return null;
    const candidates = await fetchSpotifySearchDesktopTracks(accessToken, normalizedQuery);
    if (!candidates.length) return null;
    const best = rankSpotifyTrackCandidates(candidates, expectedMetadata);
    if (!best || !best.url || best.score < 85) return null;
    return best;
  } catch (_error) {
    return null;
  }
}

async function fetchSpotifyAnonymousToken() {
  const response = await fetchWithTimeout(SPOTIFY_WEB_TOKEN_URL, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!response.ok) return "";
  const payload = await response.json();
  return String(payload?.accessToken || "").trim();
}

async function fetchSpotifySearchDesktopTracks(accessToken, query) {
  const variables = {
    searchTerm: query,
    offset: 0,
    limit: 8,
    numberOfTopResults: 5,
    includeAudiobooks: false,
    includeArtistHasConcertsField: false,
    includePreReleases: false
  };
  const extensions = {
    persistedQuery: {
      version: 1,
      sha256Hash: SPOTIFY_SEARCH_DESKTOP_SHA256
    }
  };
  const url = `${SPOTIFY_GRAPHQL_SEARCH_URL}?operationName=searchDesktop&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "App-Platform": "WebPlayer"
    }
  });
  if (!response.ok) return [];
  const payload = await response.json();
  const trackItems =
    payload?.data?.searchV2?.tracksV2?.items ||
    payload?.data?.searchV2?.tracks?.items ||
    [];

  return (Array.isArray(trackItems) ? trackItems : [])
    .map(item => normalizeSpotifyGraphqlTrack(item))
    .filter(item => item.url && item.title);
}

function normalizeSpotifyGraphqlTrack(item) {
  const data = item?.item?.data || item?.data || {};
  const id = String(data?.id || "").trim();
  const uri = String(data?.uri || "").trim();
  const title = String(data?.name || data?.title || "").trim();
  const artists = (Array.isArray(data?.artists?.items) ? data.artists.items : [])
    .map(artist => String(artist?.profile?.name || artist?.name || "").trim())
    .filter(Boolean);

  return {
    title,
    artists,
    id,
    uri,
    url: id ? `https://open.spotify.com/track/${id}` : uriToSpotifyUrl(uri)
  };
}

function uriToSpotifyUrl(uri) {
  const value = String(uri || "").trim();
  const match = value.match(/^spotify:track:([A-Za-z0-9]+)$/);
  if (!match) return "";
  return `https://open.spotify.com/track/${match[1]}`;
}

function rankSpotifyTrackCandidates(candidates, expectedMetadata = {}) {
  const expectedTitle = normalizeSearchText(expectedMetadata?.title || "");
  const expectedArtist = normalizeSearchText(expectedMetadata?.artist || "");
  const expectedQualifiers = getTrackQualifiers(`${expectedMetadata?.title || ""} ${expectedMetadata?.artist || ""}`);
  let best = null;

  for (const candidate of candidates) {
    const candidateTitle = normalizeSearchText(candidate.title);
    const firstArtist = normalizeSearchText(candidate.artists?.[0] || "");
    const allArtistsText = normalizeSearchText((candidate.artists || []).join(" "));
    let score = 0;

    if (candidateTitle === expectedTitle) score += 80;
    else if (candidateTitle.startsWith(expectedTitle) || expectedTitle.startsWith(candidateTitle)) score += 30;
    else score -= 85;

    if (firstArtist && expectedArtist && firstArtist === expectedArtist) score += 60;
    else if (expectedArtist && allArtistsText.includes(expectedArtist)) score += 25;
    else if (expectedArtist) score -= 55;

    const candidateQualifiers = getTrackQualifiers(`${candidate.title} ${(candidate.artists || []).join(" ")}`);
    score += scoreQualifierAlignment(expectedQualifiers, candidateQualifiers);

    if (hasUnexpectedVersionMismatch(expectedQualifiers, candidateQualifiers)) {
      score -= 40;
    }

    if (expectedTitle && !isStrongTitleMatch(expectedTitle, candidateTitle)) {
      score -= 60;
    }

    if (expectedArtist && !allArtistsText.includes(expectedArtist) && firstArtist !== expectedArtist) {
      score -= 35;
    }

    const enriched = { ...candidate, score };
    if (!best || enriched.score > best.score) best = enriched;
  }

  if (!best) return null;
  if (best.score < 85) return null;
  if (!isStrongTitleMatch(expectedTitle, normalizeSearchText(best.title))) return null;
  return best;
}

function isStrongTitleMatch(expectedTitle, candidateTitle) {
  if (!expectedTitle || !candidateTitle) return false;
  if (expectedTitle === candidateTitle) return true;
  if (candidateTitle.startsWith(`${expectedTitle} `)) return true;
  const expectedTokens = toQueryTokens(expectedTitle);
  const candidateTokens = toQueryTokens(candidateTitle);
  if (!expectedTokens.length || !candidateTokens.length) return false;
  const overlap = expectedTokens.filter(token => candidateTokens.includes(token)).length;
  const ratio = overlap / expectedTokens.length;
  return ratio >= 0.8;
}

function hasUnexpectedVersionMismatch(expectedQualifiers, candidateQualifiers) {
  const sensitive = ["intro", "interlude", "remix", "live", "instrumental", "acoustic"];
  for (const token of sensitive) {
    if (candidateQualifiers.has(token) && !expectedQualifiers.has(token)) {
      return true;
    }
  }
  return false;
}

function sanitizeMetadataText(value, maxLen = MAX_METADATA_TEXT_LENGTH, options = {}) {
  const { blankWhenNoisy = false } = options;
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const normalized = text.toLowerCase();
  const isNoisy = isNoisyMetadataText(normalized);
  if (isNoisy && blankWhenNoisy) {
    return "";
  }
  if (isNoisy || text.length > maxLen) {
    return `${text.slice(0, maxLen).trim()}…`;
  }
  return text;
}

function isNoisyMetadataText(normalizedText) {
  const normalized = String(normalizedText || "").toLowerCase();
  return (
    normalized.includes("provided to youtube by") ||
    normalized.includes("auto-generated by youtube") ||
    normalized.includes("official music video") ||
    normalized.includes("official lyric video") ||
    normalized.includes("lyric video") ||
    normalized.includes("visualizer") ||
    normalized.includes("watch part") ||
    normalized.includes("http://") ||
    normalized.includes("https://")
  );
}

function isLikelyNonTrackTitle(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return false;

  return (
    normalized.includes("official music video") ||
    normalized.includes("official lyric video") ||
    normalized.includes("lyric video") ||
    normalized.includes("visualizer") ||
    normalized.includes("official video") ||
    normalized.includes("part 1") ||
    normalized.includes("part 2") ||
    normalized.includes("from scream") ||
    normalized.includes("sony animation")
  );
}

async function enrichWithSpotifyFallback(data) {
  const links = Array.isArray(data?.links) ? data.links.map(item => ({ ...item })) : [];
  const spotifyEntry = links.find(item => String(item?.type || "").toLowerCase() === "spotify" && item?.url);
  if (!spotifyEntry) return { ...data, links };
  const lockArtist = Boolean(data?._lockArtist);

  try {
    const spotifyMeta = await fetchSpotifyMetadata(spotifyEntry.url);
    const spotifyQuery = buildSpotifyQueryFromMetadata(spotifyMeta);
    const shouldUseSpotifyText =
      !data?.description || isNoisyMetadataText(String(data.description || "").toLowerCase());

    let nextTitle = data?.title || "";
    let nextDescription = data?.description || "";
    let nextImage = data?.image || "";

    if (!lockArtist && (shouldUseSpotifyText || String(nextDescription).length > 80) && spotifyQuery.artist) {
      nextDescription = spotifyQuery.artist;
    }
    if (
      (!nextTitle ||
        isNoisyMetadataText(String(nextTitle).toLowerCase()) ||
        isLikelyNonTrackTitle(nextTitle)) &&
      spotifyQuery.title
    ) {
      nextTitle = spotifyQuery.title;
    }
    if ((!nextImage || nextImage.includes("i.ytimg.com")) && spotifyMeta?.image) {
      nextImage = spotifyMeta.image;
    }

    const hasWeakAppleMusicLinkIndex = links.findIndex(item => {
      const type = String(item?.type || "").toLowerCase();
      if (type !== "applemusic" && type !== "itunes") return false;
      const url = String(item?.url || "");
      return /\/artist\//.test(url) || url.includes("geo.music.apple.com");
    });

    const queryForApple = spotifyQuery.query || [spotifyQuery.title, spotifyQuery.artist].filter(Boolean).join(" ");
    let appleMusicFallbackMetadata = null;
    if (queryForApple && hasWeakAppleMusicLinkIndex !== -1) {
      const appleMusicResult = await fetchAppleMusicLinkFromItunes(queryForApple, spotifyQuery);
      appleMusicFallbackMetadata = appleMusicResult;
      if (appleMusicResult?.url) {
        links[hasWeakAppleMusicLinkIndex] = {
          ...links[hasWeakAppleMusicLinkIndex],
          type: "appleMusic",
          url: canonicalizeMediaUrl(appleMusicResult.url),
          isVerified: Boolean(appleMusicResult.isVerified),
          isProtected: Boolean(appleMusicResult.isVerified),
          source: "itunes_lookup"
        };
      }
    }

    if (!nextDescription && !lockArtist) {
      const appleMetadata =
        appleMusicFallbackMetadata ||
        (await fetchAppleMusicLinkFromItunes(data?.title || spotifyQuery.title || "", {
          title: data?.title || spotifyQuery.title || "",
          artist: "",
          query: data?.title || spotifyQuery.title || ""
        }));

      if (appleMetadata?.artist) {
        nextDescription = appleMetadata.artist;
      }
      if ((!nextTitle || isLikelyNonTrackTitle(nextTitle)) && appleMetadata?.title) {
        nextTitle = appleMetadata.title;
      }
    }

    return {
      ...data,
      title: sanitizeMetadataText(nextTitle, MAX_METADATA_TEXT_LENGTH) || data?.title || "música encontrada",
      description: sanitizeMetadataText(nextDescription, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }),
      image: nextImage || data?.image || "",
      links: dedupeAndNormalizeLinks(links)
    };
  } catch (_error) {
    return {
      ...data,
      links
    };
  }
}

async function enrichWithSecondaryFallbacks(data) {
  let next = { ...(data || {}) };
  const links = Array.isArray(next.links) ? next.links : [];
  const lockArtist = Boolean(next?._lockArtist);
  const hasMissingArtist = !String(next.description || "").trim();
  const hasMissingTitle = !String(next.title || "").trim();
  const hasMissingImage = !String(next.image || "").trim();
  const hasNoisyTitle = isLikelyNonTrackTitle(next.title || "");

  if ((!lockArtist || !hasMissingArtist) && !hasMissingTitle && !hasMissingImage && !hasNoisyTitle) {
    return next;
  }

  const deezerEntry = links.find(item => String(item?.type || "").toLowerCase() === "deezer" && item?.url);
  if (deezerEntry) {
    const deezerMeta = await fetchDeezerMetadata(deezerEntry.url);
    if (!lockArtist && deezerMeta?.artist && !String(next.description || "").trim()) {
      next.description = deezerMeta.artist;
    }
    if (deezerMeta?.title && (hasMissingTitle || hasNoisyTitle)) {
      next.title = deezerMeta.title;
    }
    if (deezerMeta?.image && !String(next.image || "").trim()) {
      next.image = deezerMeta.image;
    }
  }

  if (!lockArtist && !String(next.description || "").trim()) {
    const itunesFallback = await fetchAppleMusicLinkFromItunes(next.title || "", {
      title: next.title || "",
      artist: "",
      query: next.title || ""
    });
    if (itunesFallback?.artist) {
      next.description = itunesFallback.artist;
    }
    if (itunesFallback?.title && (hasMissingTitle || hasNoisyTitle)) {
      next.title = itunesFallback.title;
    }
  }

  return {
    ...next,
    title: sanitizeMetadataText(next.title, MAX_METADATA_TEXT_LENGTH) || "música encontrada",
    description: sanitizeMetadataText(next.description, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }),
    image: next.image || "",
    links
  };
}

async function fetchDeezerMetadata(url) {
  try {
    const response = await fetchWithTimeout(
      `${DEEZER_OEMBED_API_URL}?url=${encodeURIComponent(url)}&format=json`
    );
    if (!response.ok) return { title: "", artist: "", image: "" };
    const payload = await response.json();

    return {
      title: String(payload?.title || "").trim(),
      artist: String(payload?.author_name || "").trim(),
      image: String(payload?.thumbnail_url || "").trim()
    };
  } catch (_error) {
    return { title: "", artist: "", image: "" };
  }
}

function dedupeAndNormalizeLinks(links) {
  const byType = new Map();
  const seenCanonical = new Set();

  for (const link of links) {
    const type = String(link?.type || "").trim();
    const url = String(link?.url || "").trim();
    if (!type || !url) continue;

    const canonical = canonicalizeMediaUrl(url);
    if (seenCanonical.has(canonical)) continue;

    const key = type.toLowerCase();
    const current = { ...link, type, url: canonical };
    const existing = byType.get(key);

    if (!existing || isLinkBetter(current, existing)) {
      byType.set(key, current);
      seenCanonical.add(canonical);
    }
  }

  const values = Array.from(byType.values());
  const youtubeMusicIds = new Set(
    values
      .filter(item => String(item.type).toLowerCase() === "youtubemusic")
      .map(item => getYoutubeVideoId(item.url))
      .filter(Boolean)
  );

  return values.filter(item => {
    const key = String(item.type).toLowerCase();
    if (key !== "youtube") return true;
    const videoId = getYoutubeVideoId(item.url);
    return !(videoId && youtubeMusicIds.has(videoId));
  });
}

function isLinkBetter(candidate, existing) {
  const cScore = scoreLinkQuality(candidate);
  const eScore = scoreLinkQuality(existing);
  return cScore >= eScore;
}

function scoreLinkQuality(item) {
  const url = String(item?.url || "");
  const key = String(item?.type || "").toLowerCase();
  let score = item?.isProtected ? 90 : 0;
  score += item?.isVerified ? 20 : 0;
  if (!isSearchLikeUrl(url, key)) score += 10;
  if (String(item?.source || "").toLowerCase() === "primary_api" && (key === "spotify" || key === "applemusic" || key === "itunes")) {
    score -= 40;
  }

  if (key === "applemusic" || key === "itunes") {
    if (/\/album\/.+\?i=\d+/.test(url)) score += 20;
    if (/\/artist\//.test(url)) score -= 15;
  }
  if (key === "youtube" || key === "youtubemusic") {
    if (getYoutubeVideoId(url)) score += 10;
    if (url.includes("/search")) score -= 10;
  }

  return score;
}

function canonicalizeMediaUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();

    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      const videoId = getYoutubeVideoId(url.toString());
      if (videoId) {
        const isMusic = host.includes("music.youtube.com");
        return `${isMusic ? "https://music.youtube.com/watch?v=" : "https://www.youtube.com/watch?v="}${videoId}`;
      }
    }

    if (host.includes("music.apple.com")) {
      url.searchParams.delete("l");
      url.hash = "";
      return url.toString();
    }

    url.hash = "";
    return url.toString();
  } catch (_error) {
    return String(value || "").trim();
  }
}

async function enforceInputTrackGroundTruth(data, sourceLink) {
  const sourceAppleTrack = extractAppleTrackInputContext(sourceLink);
  if (!sourceAppleTrack.url) return data;

  const links = Array.isArray(data?.links) ? data.links : [];
  const filtered = links.filter(item => {
    const type = String(item?.type || "").toLowerCase();
    return type !== "applemusic" && type !== "itunes";
  });

  const appleTrackMetadata = sourceAppleTrack.trackId
    ? await fetchAppleTrackMetadataById(sourceAppleTrack.trackId)
    : null;

  const mergedDescription = [appleTrackMetadata?.artist || "", appleTrackMetadata?.album || ""]
    .filter(Boolean)
    .join(" • ");

  return {
    ...(data || {}),
    title: appleTrackMetadata?.title || data?.title || "",
    description: mergedDescription || data?.description || "",
    album: appleTrackMetadata?.album || data?.album || "",
    image: appleTrackMetadata?.image || data?.image || "",
    links: dedupeAndNormalizeLinks([
      {
        type: "appleMusic",
        url: sourceAppleTrack.url,
        isVerified: true,
        isProtected: true,
        source: "input"
      },
      ...filtered
    ])
  };
}

function extractAppleTrackInputContext(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!parsed.hostname.toLowerCase().includes("music.apple.com")) return { url: "", trackId: "" };
    const trackId = parsed.searchParams.get("i") || "";
    if (!trackId) return { url: "", trackId: "" };
    return {
      url: canonicalizeMediaUrl(parsed.toString()),
      trackId
    };
  } catch (_error) {
    return { url: "", trackId: "" };
  }
}

async function fetchAppleTrackMetadataById(trackId) {
  const normalizedTrackId = String(trackId || "").trim();
  if (!normalizedTrackId) return null;

  try {
    const response = await fetchWithTimeout(`${ITUNES_SEARCH_API_URL.replace(/\/search$/, "/lookup")}?id=${encodeURIComponent(normalizedTrackId)}&entity=song&limit=1`);
    if (!response.ok) return null;
    const payload = await response.json();
    const firstSong = (Array.isArray(payload?.results) ? payload.results : []).find(item => String(item?.kind || "").toLowerCase() === "song");
    if (!firstSong) return null;

    return {
      title: String(firstSong?.trackName || "").trim(),
      artist: String(firstSong?.artistName || "").trim(),
      album: String(firstSong?.collectionName || "").trim(),
      image: String(firstSong?.artworkUrl100 || firstSong?.artworkUrl60 || "").trim()
    };
  } catch (_error) {
    return null;
  }
}

function getYoutubeVideoId(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") return url.pathname.replace("/", "").trim();
    if (host.includes("youtube.com")) return url.searchParams.get("v") || "";
    return "";
  } catch (_error) {
    return "";
  }
}

function pickImageFromLinks(links) {
  for (const item of links) {
    const videoId = getYoutubeVideoId(item?.url || "");
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
  }
  return "";
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
      data: {
        ...data,
        links: (Array.isArray(data?.links) ? data.links : []).map(item => ({
          ...item,
          source: "primary_api"
        }))
      }
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
  return fetchSongLink(link, { markVerified: true, protectVerified: true });
}

async function fetchSongLinkAsFallback(link) {
  return fetchSongLink(link, { markVerified: true, protectVerified: true });
}

async function fetchSongLink(link, { markVerified = false, protectVerified = false } = {}) {
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

    const normalized = normalizeSongLinkPayload(data, { markVerified, protectVerified });
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

function normalizeSongLinkPayload(data, { markVerified = false, protectVerified = false } = {}) {
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
        isVerified: markVerified,
        isProtected: Boolean(markVerified && protectVerified),
        source: "songlink"
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
  if (key === "itunes" || key === "apple" || key === "applemusic") return "appleMusic";

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
  if (lower.includes("music.apple.com") || lower.includes("itunes.apple.com")) return true;
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
    if (existing?.isProtected) {
      byType.set(key, {
        ...existing,
        isVerified: Boolean(existing?.isVerified || item?.isVerified),
        isProtected: true
      });
      continue;
    }
    if (item?.isProtected) {
      byType.set(key, {
        ...item,
        isVerified: Boolean(item?.isVerified),
        isProtected: true
      });
      continue;
    }
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

    const bestCandidate = isLinkBetter(item, existing) ? item : existing;
    byType.set(key, {
      ...bestCandidate,
      isVerified: Boolean(existing?.isVerified || item?.isVerified || bestCandidate?.isVerified),
      isProtected: Boolean(existing?.isProtected || item?.isProtected || bestCandidate?.isProtected)
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
