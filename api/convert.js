const PRIMARY_API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";
const SONGLINK_API_URL = "https://api.song.link/v1-alpha.1/links";
const ITUNES_SEARCH_API_URL = "https://itunes.apple.com/search";
const SPOTIFY_OEMBED_API_URL = "https://open.spotify.com/oembed";
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
const YT_CONFIDENCE_THRESHOLDS = {
  high: 75,
  medium: 50
};

const VERSION_MARKERS = [
  "live",
  "acoustic",
  "demo",
  "remix",
  "instrumental",
  "karaoke",
  "sped up",
  "slowed",
  "from the vault",
  "radio edit",
  "extended",
  "edit",
  "remaster",
  "session",
  "lyric video",
  "visualizer",
  "official video",
  "official music video",
  "take away show",
  "tribute",
  "cover",
  "reaction",
  "fan made",
  "unofficial"
];

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
].map(buildSampleCacheIdentity));

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

      const finalizedData = await finalizeResultData(preparePayloadForFinalization(mergedData, link));
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, finalizedData, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return res.status(200).json({ ok: true, data: finalizedData });
    }

    const fallbackResult = shouldUseSongLinkFirst
      ? await fetchPrimaryApi(link, adapters)
      : await fetchSongLinkAsFallback(link);

    if (fallbackResult.ok) {
      const finalizedData = await finalizeResultData(preparePayloadForFinalization(fallbackResult.data, link));
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, finalizedData, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return res.status(200).json({ ok: true, data: finalizedData });
    }

    if (platform === "spotify") {
      const spotifyFallback = await buildSpotifySearchFallback(link);
      if (spotifyFallback.ok) {
        const finalizedData = await finalizeResultData(preparePayloadForFinalization(spotifyFallback.data, link));
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
    data: await finalizeResultData({
      ...metadataPayload,
      links
    })
  };
}

function preparePayloadForFinalization(payload, sourceLink = "") {
  const platform = detectPlatformFromUrl(sourceLink);
  const isTrustedSource = platform === "spotify" || platform === "apple music";
  const groundTruth = buildGroundTruth(payload, { trustAsCanonical: isTrustedSource });
  return {
    ...(payload || {}),
    groundTruth,
    trustMetadata: isTrustedSource || Boolean(payload?.trustMetadata)
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

function buildSampleCacheIdentity(link) {
  try {
    const parsed = new URL(normalizeSampleLink(link));
    const host = parsed.hostname.toLowerCase();
    if (host.includes("music.apple.com")) {
      const trackId = parsed.searchParams.get("i");
      if (trackId) {
        return `apple-track:${trackId.trim()}`;
      }
    }
    return parsed.toString();
  } catch (_error) {
    return normalizeSampleLink(link);
  }
}

function buildSampleCacheKey(link) {
  const identity = buildSampleCacheIdentity(link);
  if (!SAMPLE_CACHEABLE_LINKS.has(identity)) return null;
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

  const [artistFromDescription = ""] = String(metadata?.description || "").split("·");
  const artist = artistFromDescription.trim();

  return {
    title,
    artist,
    query: [title, artist].filter(Boolean).join(" ").trim()
  };
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
  const trustedGroundTruth = buildGroundTruth(base.groundTruth || base, {
    trustAsCanonical: Boolean(base?.trustMetadata)
  });

  const title = pickBestTrackTitle(
    trustedGroundTruth.title,
    base.title,
    enriched.title,
    fallback.title,
    "música encontrada"
  );
  const description =
    trustedGroundTruth.artist ||
    base.description ||
    enriched.description ||
    fallback.description ||
    "";
  const album = trustedGroundTruth.album || base.album || enriched.album || fallback.album || "";

  return {
    title,
    description,
    album,
    image: enriched.image || base.image || fallback.image || "",
    isrc: trustedGroundTruth.isrc || base.isrc || enriched.isrc || fallback.isrc || "",
    durationMs: trustedGroundTruth.durationMs || base.durationMs || enriched.durationMs || fallback.durationMs || 0,
    groundTruth: trustedGroundTruth,
    trustMetadata: Boolean(trustedGroundTruth.title && trustedGroundTruth.artist),
    universalLink: enriched.universalLink || base.universalLink || fallback.universalLink || ""
  };
}

async function finalizeResultData(data) {
  const payload = data || {};
  const trustedGroundTruth = buildGroundTruth(payload?.groundTruth || payload, {
    trustAsCanonical: Boolean(payload?.trustMetadata)
  });
  const normalizedLinks = dedupeAndNormalizeLinks(Array.isArray(payload.links) ? payload.links : []);
  const pairedYoutubeLinks = ensureYoutubePlatformPairs(normalizedLinks);
  const youtubeValidatedLinks = await classifyYoutubeLinks(pairedYoutubeLinks, payload, trustedGroundTruth);
  const imageFromLinks = pickImageFromLinks(normalizedLinks);
  const base = {
    ...payload,
    title: pickBestTrackTitle(trustedGroundTruth.title, payload.title, "música encontrada") || "música encontrada",
    description: sanitizeMetadataText(
      trustedGroundTruth.artist || payload.description,
      MAX_METADATA_TEXT_LENGTH,
      { blankWhenNoisy: true }
    ),
    album: sanitizeMetadataText(trustedGroundTruth.album || payload.album, MAX_METADATA_TEXT_LENGTH),
    isrc: trustedGroundTruth.isrc || payload.isrc || "",
    durationMs: trustedGroundTruth.durationMs || payload.durationMs || 0,
    groundTruth: trustedGroundTruth,
    trustMetadata: Boolean(payload?.trustMetadata || trustedGroundTruth.title),
    image: payload.image || imageFromLinks || "",
    links: youtubeValidatedLinks
  };
  if (normalizeSearchText(base.description) === normalizeSearchText(base.title)) {
    base.description = "";
  }

  const spotifyEnriched = await enrichWithSpotifyFallback(base, trustedGroundTruth);
  const secondaryEnriched = await enrichWithSecondaryFallbacks(spotifyEnriched, trustedGroundTruth);
  return enrichWithAppleBridgeFallback(secondaryEnriched);
}

async function classifyYoutubeLinks(links, metadata, groundTruth = {}) {
  const items = Array.isArray(links) ? links.map(item => ({ ...item })) : [];
  const title = String(groundTruth?.title || metadata?.title || "").trim();
  const artist = String(groundTruth?.artist || metadata?.description || "").split("•")[0].trim();
  const canonicalQuery = [title, artist].filter(Boolean).join(" ").trim();
  const sourceDurationSeconds = Number(groundTruth?.durationMs || metadata?.durationMs || 0) > 0
    ? Number(groundTruth?.durationMs || metadata?.durationMs) / 1000
    : 0;
  const isrc = String(groundTruth?.isrc || metadata?.isrc || "").trim();
  const decisionCache = new Map();

  await Promise.all(
    items.map(async item => {
      const type = String(item?.type || "").toLowerCase();
      if (type !== "youtube" && type !== "youtubemusic") return;
      const originalVideoId = getYoutubeVideoId(item?.url);
      const targetPlatform = type === "youtubemusic" ? "youtubeMusic" : "youtube";
      const cacheKey = `${targetPlatform}:${canonicalizeYoutubeWatchUrl(item?.url) || String(item?.url || "")}`;
      let decision = decisionCache.get(cacheKey);
      if (!decision) {
        decision = await chooseYoutubeCandidate({
          targetPlatform,
          currentUrl: item?.url,
          title,
          artist,
          sourceDurationSeconds,
          isrc
        });
        decisionCache.set(cacheKey, decision);
      }
      item.url = decision.promoteDirect ? decision.url : buildPlatformSearchUrl(targetPlatform, canonicalQuery);
      item.isVerified = Boolean(decision.promoteDirect);
      item.confidence = decision.confidence;
      item.score = decision.score;
      item.scoreBreakdown = decision.breakdown;
      if (originalVideoId) item.sourceVideoId = originalVideoId;
    })
  );

  const recovered = await maybeRecoverYoutubeLinks({
    items,
    title,
    artist,
    sourceDurationSeconds,
    isrc
  });

  return recovered.map(item => {
    const next = { ...item };
    delete next.sourceVideoId;
    return next;
  });
}

async function maybeRecoverYoutubeLinks({ items, title, artist, sourceDurationSeconds = 0, isrc = "" }) {
  const next = Array.isArray(items) ? items.map(item => ({ ...item })) : [];
  const metadataStrongEnough = Boolean(normalizeSearchText(title) && normalizeSearchText(artist));
  const yt = next.find(item => String(item?.type || "").toLowerCase() === "youtube");
  const ytm = next.find(item => String(item?.type || "").toLowerCase() === "youtubemusic");
  const ytIsSearch = isSearchLikeUrl(yt?.url, "youtube");
  const ytmIsSearch = isSearchLikeUrl(ytm?.url, "youtubemusic");
  const hasDirectYt = Boolean(yt?.url && !ytIsSearch && getYoutubeVideoId(yt.url));
  const hasDirectYtm = Boolean(ytm?.url && !ytmIsSearch && getYoutubeVideoId(ytm.url));
  const knownVideoId =
    getYoutubeVideoId(yt?.url) ||
    getYoutubeVideoId(ytm?.url) ||
    String(yt?.sourceVideoId || "") ||
    String(ytm?.sourceVideoId || "");

  if (knownVideoId) {
    return upsertYoutubePairByVideoId(next, knownVideoId, {
      setVerified: hasDirectYt || hasDirectYtm
    });
  }

  const bothSearchOnly = Boolean(yt?.url && ytm?.url && ytIsSearch && ytmIsSearch);
  const missingEither = !yt || !ytm;
  const lowConfidenceOnly =
    [yt, ytm].filter(Boolean).length > 0 &&
    [yt, ytm]
      .filter(Boolean)
      .every(item => (item?.score || 0) < YT_CONFIDENCE_THRESHOLDS.medium);
  const shouldRecover = metadataStrongEnough && (bothSearchOnly || missingEither || lowConfidenceOnly);
  if (!shouldRecover) return next;

  let resolvedVideoId = "";
  if (!hasDirectYtm || missingEither || ytmIsSearch) {
    const audioCandidate = await findBestYoutubeCandidate({
      title,
      artist,
      sourceDurationSeconds,
      preferAudio: true,
      isrc
    });
    resolvedVideoId = audioCandidate?.videoId || "";
  }

  if (!resolvedVideoId && (!hasDirectYt || missingEither || ytIsSearch)) {
    const videoCandidate = await findBestYoutubeCandidate({
      title,
      artist,
      sourceDurationSeconds,
      preferAudio: false,
      isrc
    });
    resolvedVideoId = videoCandidate?.videoId || "";
  }

  if (!resolvedVideoId) return next;
  return upsertYoutubePairByVideoId(next, resolvedVideoId, { setVerified: true });
}

function upsertYoutubePairByVideoId(links, videoId, { setVerified = false } = {}) {
  const next = Array.isArray(links) ? links.map(item => ({ ...item })) : [];
  if (!videoId) return next;

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const youtubeMusicUrl = `https://music.youtube.com/watch?v=${videoId}`;
  const ytIndex = next.findIndex(item => String(item?.type || "").toLowerCase() === "youtube");
  const ytmIndex = next.findIndex(item => String(item?.type || "").toLowerCase() === "youtubemusic");

  if (ytIndex === -1) {
    next.push({ type: "youtube", url: youtubeUrl, isVerified: Boolean(setVerified) });
  } else if (isSearchLikeUrl(next[ytIndex]?.url, "youtube") || !getYoutubeVideoId(next[ytIndex]?.url)) {
    next[ytIndex] = { ...next[ytIndex], url: youtubeUrl, isVerified: Boolean(setVerified || next[ytIndex]?.isVerified) };
  }

  if (ytmIndex === -1) {
    next.push({ type: "youtubeMusic", url: youtubeMusicUrl, isVerified: Boolean(setVerified) });
  } else if (isSearchLikeUrl(next[ytmIndex]?.url, "youtubemusic") || !getYoutubeVideoId(next[ytmIndex]?.url)) {
    next[ytmIndex] = {
      ...next[ytmIndex],
      url: youtubeMusicUrl,
      isVerified: Boolean(setVerified || next[ytmIndex]?.isVerified)
    };
  }

  return dedupeAndNormalizeLinks(next);
}

function looksLikeOfficialVideoHint(hint) {
  const title = String(hint?.title || "");
  const description = String(hint?.description || "");
  const channel = String(hint?.channel || "");
  return (
    /(official music video|official video|official lyric video|lyric video|visualizer)/i.test(title) ||
    /(official music video|official video|official lyric video|lyric video|visualizer)/i.test(description) ||
    /vevo$/i.test(channel)
  );
}

async function findBestYoutubeCandidate({ title, artist, sourceDurationSeconds = 0, preferAudio = false, isrc = "" }) {
  const baseQuery = [title, artist].filter(Boolean).join(" ").trim();
  if (!baseQuery) return null;

  const queries = preferAudio ? [`${baseQuery} topic`, `${baseQuery} audio`, baseQuery] : [`${baseQuery} official video`, baseQuery];

  const videoIds = [];
  for (const query of queries) {
    const ids = await searchYoutubeVideoIds(query);
    for (const id of ids) {
      if (!videoIds.includes(id)) videoIds.push(id);
      if (videoIds.length >= 12) break;
    }
    if (videoIds.length >= 12) break;
  }
  if (!videoIds.length) return null;

  const candidates = [];
  for (const videoId of videoIds.slice(0, 6)) {
    const hint = await fetchYouTubeHints(`https://www.youtube.com/watch?v=${videoId}`);
    const scored = scoreYoutubeCandidate({
      hint,
      title,
      artist,
      sourceDurationSeconds,
      preferAudio,
      isrc
    });
    candidates.push({ videoId, hint, ...scored });
  }

  candidates.sort((a, b) => b.total - a.total);
  const best = candidates[0];
  if (!best || best.total < YT_CONFIDENCE_THRESHOLDS.medium) return null;
  if (preferAudio && !isAudioCertifiedHint(best.hint) && best.confidence !== "high") return null;
  return best;
}

async function searchYoutubeVideoIds(query) {
  try {
    const response = await fetchWithTimeout(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml"
        }
      }
    );
    if (!response.ok) return [];
    const html = await response.text();
    const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || [];
    const ids = [];
    const seen = new Set();
    for (const entry of matches) {
      const idMatch = entry.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      const id = idMatch?.[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= 12) break;
    }
    return ids;
  } catch (_error) {
    return [];
  }
}

function scoreYoutubeCandidate({ hint, title, artist, sourceDurationSeconds = 0, preferAudio = false, isrc = "" }) {
  const platform = preferAudio ? "youtubeMusic" : "youtube";
  const sourceQualifiers = extractVersionQualifiers(title);
  const candidateText = `${hint?.title || ""} ${hint?.description || ""}`;
  const candidateQualifiers = extractVersionQualifiers(candidateText);

  const breakdown = {
    title: scoreTitleMatch(title, hint?.title),
    artist: scoreArtistMatch(artist, `${hint?.channel || ""} ${hint?.title || ""}`),
    version: scoreVersionMatch(sourceQualifiers, candidateQualifiers),
    duration: scoreDurationMatch(sourceDurationSeconds, Number(hint?.durationSeconds || 0), platform),
    channelType: scoreChannelType(platform, hint, artist),
    negatives: scoreNegativeSignals(sourceQualifiers, candidateQualifiers),
    officialBonus: scoreOfficialBonus({ platform, hint, title, artist, sourceDurationSeconds, isrc })
  };
  const total = Object.values(breakdown).reduce((acc, value) => acc + value, 0);
  return {
    total,
    confidence: classifyConfidence(total),
    breakdown,
    hasVersionConflict: breakdown.version <= -18
  };
}

function isAudioCertifiedHint(hint) {
  const channel = String(hint?.channel || "").toLowerCase();
  const description = normalizeSearchText(hint?.description || "");
  return (
    /(?:\s-\s)(topic|tema)$/.test(channel) ||
    description.includes("auto generated by youtube") ||
    description.includes("provided to youtube by")
  );
}

async function chooseYoutubeCandidate({ targetPlatform, currentUrl, title, artist, sourceDurationSeconds = 0, isrc = "" }) {
  const normalizedQuery = [title, artist].filter(Boolean).join(" ").trim();
  const preferAudio = targetPlatform === "youtubeMusic";
  const baseCandidate = await scoreCurrentYoutubeCandidate(currentUrl, {
    title,
    artist,
    sourceDurationSeconds,
    preferAudio,
    isrc
  });
  const winner = baseCandidate;

  if (!winner) {
    return {
      url: buildPlatformSearchUrl(targetPlatform, normalizedQuery),
      promoteDirect: false,
      confidence: "low",
      score: 0,
      breakdown: {}
    };
  }

  const isMedium = winner.total >= YT_CONFIDENCE_THRESHOLDS.medium && winner.total < YT_CONFIDENCE_THRESHOLDS.high;
  const promoteDirect = winner.total >= YT_CONFIDENCE_THRESHOLDS.high || (isMedium && shouldPromoteMediumConfidence(targetPlatform, winner));

  return {
    url: promoteDirect ? buildYoutubeUrl(targetPlatform, winner.videoId) : buildPlatformSearchUrl(targetPlatform, normalizedQuery),
    promoteDirect,
    confidence: classifyConfidence(winner.total),
    score: winner.total,
    breakdown: winner.breakdown || {}
  };
}

async function scoreCurrentYoutubeCandidate(url, { title, artist, sourceDurationSeconds = 0, preferAudio = false, isrc = "" }) {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;
  const hint = await fetchYouTubeHints(url);
  const scored = scoreYoutubeCandidate({ hint, title, artist, sourceDurationSeconds, preferAudio, isrc });
  return { videoId, hint, ...scored };
}

function shouldPromoteMediumConfidence(targetPlatform, candidate) {
  if (!candidate || candidate.hasVersionConflict) return false;
  if (targetPlatform === "youtubeMusic") {
    return (candidate.breakdown?.channelType || 0) >= 20;
  }
  return (candidate.breakdown?.channelType || 0) >= 18 && (candidate.breakdown?.title || 0) >= 18;
}

function buildYoutubeUrl(type, videoId) {
  if (!videoId) return "";
  return type === "youtubeMusic"
    ? `https://music.youtube.com/watch?v=${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

function buildPlatformSearchUrl(type, query) {
  const encoded = encodeURIComponent(query || "");
  if (type === "youtubeMusic") return `https://music.youtube.com/search?q=${encoded}`;
  return `https://www.youtube.com/results?search_query=${encoded}`;
}

function classifyConfidence(score) {
  if (score >= YT_CONFIDENCE_THRESHOLDS.high) return "high";
  if (score >= YT_CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

function scoreTitleMatch(sourceTitle, candidateTitle) {
  const sourceBase = normalizeTitleBase(sourceTitle);
  const candidateBase = normalizeTitleBase(candidateTitle);
  if (!sourceBase || !candidateBase) return 0;
  if (sourceBase === candidateBase) return 40;
  if (candidateBase.startsWith(sourceBase) || sourceBase.startsWith(candidateBase)) return 28;
  const similarity = computeTokenSimilarity(sourceBase, candidateBase);
  if (similarity >= 0.75) return 18;
  if (similarity >= 0.45) return 6;
  return -35;
}

function scoreArtistMatch(sourceArtist, candidateArtistBlob) {
  const source = normalizeSearchText(sourceArtist);
  const candidate = normalizeSearchText(candidateArtistBlob);
  if (!source || !candidate) return 0;
  if (source === candidate) return 30;
  if (candidate.includes(source)) return 20;
  const overlap = computeTokenSimilarity(source, candidate);
  if (overlap >= 0.5) return 10;
  return -30;
}

function scoreVersionMatch(sourceQualifiers, candidateQualifiers) {
  if (!sourceQualifiers.size && !candidateQualifiers.size) return 0;
  let score = 0;
  for (const marker of sourceQualifiers) {
    score += candidateQualifiers.has(marker) ? 24 : -12;
  }
  for (const marker of candidateQualifiers) {
    if (sourceQualifiers.has(marker)) continue;
    score += ["karaoke", "tribute", "reaction", "fan made", "unofficial"].includes(marker) ? -28 : -18;
  }
  return score;
}

function scoreDurationMatch(sourceDurationSeconds, candidateDurationSeconds, platform) {
  if (!sourceDurationSeconds || !candidateDurationSeconds) return 0;
  const diff = Math.abs(sourceDurationSeconds - candidateDurationSeconds);
  if (diff <= 2) return 22;
  if (diff <= 5) return 14;
  if (diff <= 10) return 6;
  if (diff <= 20) return platform === "youtube" ? -4 : -8;
  return platform === "youtube" ? -12 : -18;
}

function scoreChannelType(platform, hint, artist) {
  const channel = String(hint?.channel || "").toLowerCase();
  const title = String(hint?.title || "").toLowerCase();
  const description = String(hint?.description || "").toLowerCase();
  const artistNorm = normalizeSearchText(artist);
  const channelNorm = normalizeSearchText(channel);
  const isTopic = /(?:\s-\s)(topic|tema)$/.test(channel);
  const isAutoGenerated = description.includes("auto-generated by youtube") || description.includes("provided to youtube by");
  const isOfficialVideo = /(official music video|official video)/i.test(title);
  const isVevo = /vevo$/i.test(channel);
  const channelLooksOfficial = Boolean(artistNorm && channelNorm.includes(artistNorm));

  if (platform === "youtubeMusic") {
    let score = 0;
    if (isTopic) score += 18;
    if (isAutoGenerated) score += 16;
    if (isOfficialVideo) score -= 18;
    if (isVevo) score -= 8;
    return score;
  }

  let score = 0;
  if (title.includes("official music video")) score += 24;
  else if (title.includes("official video")) score += 22;
  if (isVevo) score += 20;
  if (channelLooksOfficial) score += 18;
  if (isTopic || isAutoGenerated) score -= 10;
  return score;
}

function scoreNegativeSignals(sourceQualifiers, candidateQualifiers) {
  let score = 0;
  for (const marker of candidateQualifiers) {
    if (sourceQualifiers.has(marker)) continue;
    if (["session", "take away show", "karaoke", "reaction", "fan made", "tribute", "unofficial"].includes(marker)) score -= 20;
    else if (["live", "acoustic", "instrumental", "remix", "cover", "lyric video", "visualizer"].includes(marker)) score -= 12;
    else score -= 6;
  }
  return score;
}

function scoreOfficialBonus({ platform, hint, title, artist, sourceDurationSeconds = 0, isrc = "" }) {
  let score = 0;
  if (String(isrc || "").trim() && String(hint?.description || "").toUpperCase().includes(String(isrc).toUpperCase())) score += 100;
  const titleScore = scoreTitleMatch(title, hint?.title);
  const artistScore = scoreArtistMatch(artist, `${hint?.channel || ""} ${hint?.title || ""}`);
  const durationScore = scoreDurationMatch(sourceDurationSeconds, Number(hint?.durationSeconds || 0), platform);
  if (platform === "youtubeMusic" && isAudioCertifiedHint(hint) && titleScore >= 28 && artistScore >= 20 && durationScore >= 14) score += 18;
  if (platform === "youtube" && looksLikeOfficialVideoHint(hint) && titleScore >= 18 && artistScore >= 20 && durationScore >= 6) score += 16;
  return score;
}

function extractVersionQualifiers(value) {
  const normalized = normalizeSearchText(value || "");
  const found = new Set();
  for (const marker of VERSION_MARKERS) {
    if (normalized.includes(normalizeSearchText(marker))) {
      found.add(marker);
    }
  }
  return found;
}

function normalizeTitleBase(value) {
  let normalized = normalizeSearchText(value || "");
  for (const marker of VERSION_MARKERS) {
    const markerNorm = normalizeSearchText(marker);
    if (!markerNorm) continue;
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(markerNorm)}\\b`, "g"), " ");
  }
  return normalized.replace(/\s+/g, " ").trim();
}

function computeTokenSimilarity(a, b) {
  const aTokens = new Set((a || "").split(" ").filter(Boolean));
  const bTokens = new Set((b || "").split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  const overlap = Array.from(aTokens).filter(token => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union ? overlap / union : 0;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchYouTubeHints(url) {
  const watchUrl = canonicalizeYoutubeWatchUrl(url);
  if (!watchUrl) return { title: "", channel: "", description: "", durationSeconds: 0 };

  try {
    const [oEmbedResponse, watchResponse] = await Promise.all([
      fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`),
      fetchWithTimeout(watchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml"
        }
      })
    ]);

    let title = "";
    let channel = "";
    if (oEmbedResponse.ok) {
      const payload = await oEmbedResponse.json();
      title = String(payload?.title || "").trim();
      channel = String(payload?.author_name || "").trim();
    }

    if (!watchResponse.ok) {
      return {
        title,
        channel,
        description: "",
        durationSeconds: 0
      };
    }

    const html = await watchResponse.text();
    const playerResponse = extractYouTubePlayerResponse(html);

    return {
      title: title || String(playerResponse?.videoDetails?.title || "").trim(),
      channel: channel || String(playerResponse?.videoDetails?.author || "").trim(),
      description: String(playerResponse?.videoDetails?.shortDescription || "").trim(),
      durationSeconds: Number(playerResponse?.videoDetails?.lengthSeconds || 0)
    };
  } catch (_error) {
    return { title: "", channel: "", description: "", durationSeconds: 0 };
  }
}

function extractYouTubePlayerResponse(html) {
  const match = String(html || "").match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(match[1]);
  } catch (_error) {
    return null;
  }
}

function evaluateYouTubeVerification({ type, hint, title, artist, sourceDurationSeconds = 0 }) {
  const normalizedTitle = normalizeSearchText(hint?.title || "");
  const normalizedChannel = normalizeSearchText(hint?.channel || "");
  const normalizedDescription = normalizeSearchText(hint?.description || "");
  const normalizedSourceTitle = normalizeSearchText(title || "");
  const normalizedSourceArtist = normalizeSearchText(artist || "");

  const matchesTrackTitle =
    normalizedTitle &&
    normalizedSourceTitle &&
    (normalizedTitle.includes(normalizedSourceTitle) || normalizedSourceTitle.includes(normalizedTitle));
  const matchesTrackArtist =
    normalizedChannel &&
    normalizedSourceArtist &&
    (normalizedChannel.includes(normalizedSourceArtist) || normalizedSourceArtist.includes(normalizedChannel));

  const isTopicChannel = /(?:\s-\s)(topic|tema)$/.test(String(hint?.channel || "").toLowerCase());
  const isAutoGeneratedTrack =
    normalizedDescription.includes("auto generated by youtube") ||
    normalizedDescription.includes("provided to youtube by");
  const isLikelyOfficialVideo =
    /(official music video|official video|official lyric video|lyric video|visualizer)/i.test(
      String(hint?.title || "")
    ) ||
    /(official music video|official video|official lyric video|lyric video|visualizer)/i.test(
      String(hint?.description || "")
    ) ||
    /vevo$/i.test(String(hint?.channel || ""));
  const hasDurationMatch =
    sourceDurationSeconds > 0 &&
    Number(hint?.durationSeconds || 0) > 0 &&
    Math.abs(Number(hint.durationSeconds) - sourceDurationSeconds) <= 2;

  if (type === "youtubemusic") {
    if (isLikelyOfficialVideo && !isAutoGeneratedTrack && !hasDurationMatch) return false;
    return Boolean(isTopicChannel || isAutoGeneratedTrack || hasDurationMatch || matchesTrackTitle || matchesTrackArtist);
  }

  return Boolean(isLikelyOfficialVideo || hasDurationMatch || matchesTrackTitle || matchesTrackArtist);
}

function canonicalizeYoutubeWatchUrl(value) {
  const videoId = getYoutubeVideoId(value);
  if (!videoId) return "";
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function ensureYoutubePlatformPairs(links) {
  const items = Array.isArray(links) ? links.map(item => ({ ...item })) : [];
  const hasYoutube = items.some(item => String(item?.type || "").toLowerCase() === "youtube");
  const hasYoutubeMusic = items.some(item => String(item?.type || "").toLowerCase() === "youtubemusic");

  if (hasYoutube && hasYoutubeMusic) return items;

  if (!hasYoutubeMusic) {
    const youtubeItem = items.find(item => String(item?.type || "").toLowerCase() === "youtube" && getYoutubeVideoId(item?.url));
    if (youtubeItem) {
      const videoId = getYoutubeVideoId(youtubeItem.url);
      items.push({
        type: "youtubeMusic",
        url: `https://music.youtube.com/watch?v=${videoId}`,
        isVerified: false
      });
    }
  }

  if (!hasYoutube) {
    const youtubeMusicItem = items.find(
      item => String(item?.type || "").toLowerCase() === "youtubemusic" && getYoutubeVideoId(item?.url)
    );
    if (youtubeMusicItem) {
      const videoId = getYoutubeVideoId(youtubeMusicItem.url);
      items.push({
        type: "youtube",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        isVerified: false
      });
    }
  }

  return dedupeAndNormalizeLinks(items);
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
    const [songLinkFromApple, primaryFromApple] = await Promise.all([
      fetchSongLink(appleUrl, { markVerified: true }),
      fetchPrimaryApi(appleUrl)
    ]);

    if (songLinkFromApple.ok) {
      mergedLinks = mergeLinkResults({ links: mergedLinks }, songLinkFromApple.data).links;
    }
    if (primaryFromApple.ok) {
      mergedLinks = mergeLinkResults({ links: mergedLinks }, primaryFromApple.data).links;
    }
  } catch (_error) {
    return maybeInjectSpotifySearchFallback(next, mergedLinks);
  }

  return maybeInjectSpotifySearchFallback(next, mergedLinks);
}

function maybeInjectSpotifySearchFallback(data, links) {
  const nextLinks = Array.isArray(links) ? links.map(item => ({ ...item })) : [];
  const hasSpotify = nextLinks.some(item => String(item?.type || "").toLowerCase() === "spotify");
  if (!hasSpotify) {
    const spotifySearchUrl = buildSpotifySearchUrlFromResult(data);
    if (spotifySearchUrl) {
      nextLinks.push({
        type: "spotify",
        url: spotifySearchUrl,
        isVerified: false
      });
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

function buildGroundTruth(source, { trustAsCanonical = false } = {}) {
  const raw = source || {};
  const description = String(raw?.description || "").split("•")[0].trim();
  const preferredTitle = pickBestTrackTitle(raw?.title, raw?.trackTitle, raw?.name);
  const title = sanitizeMetadataText(preferredTitle, MAX_METADATA_TEXT_LENGTH) || "";
  let artist = sanitizeMetadataText(raw?.artist || description, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }) || "";
  if (normalizeSearchText(artist) === normalizeSearchText(title)) {
    artist = "";
  }
  return {
    title,
    artist,
    album: sanitizeMetadataText(raw?.album, MAX_METADATA_TEXT_LENGTH) || "",
    durationMs: Number(raw?.durationMs || 0) || 0,
    isrc: String(raw?.isrc || "").trim().toUpperCase(),
    versionQualifiers: Array.from(extractVersionQualifiers(title)),
    trustAsCanonical: Boolean(trustAsCanonical && title && artist)
  };
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
    isGenericResultLabel(normalized) ||
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

async function enrichWithSpotifyFallback(data, groundTruth = {}) {
  const links = Array.isArray(data?.links) ? data.links.map(item => ({ ...item })) : [];
  const spotifyEntry = links.find(item => String(item?.type || "").toLowerCase() === "spotify" && item?.url);
  if (!spotifyEntry) return { ...data, links };

  try {
    const spotifyMeta = await fetchSpotifyMetadata(spotifyEntry.url);
    const spotifyQuery = buildSpotifyQueryFromMetadata(spotifyMeta);
    const shouldUseSpotifyText =
      !data?.description || isNoisyMetadataText(String(data.description || "").toLowerCase());

    let nextTitle = data?.title || "";
    let nextDescription = data?.description || "";
    let nextImage = data?.image || "";

    if (!groundTruth?.trustAsCanonical && (shouldUseSpotifyText || String(nextDescription).length > 80) && spotifyQuery.artist) {
      nextDescription = spotifyQuery.artist;
    }
    if (
      !groundTruth?.trustAsCanonical &&
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
          isVerified: Boolean(appleMusicResult.isVerified)
        };
      }
    }

    if (!nextDescription) {
      const appleMetadata =
        appleMusicFallbackMetadata ||
        (await fetchAppleMusicLinkFromItunes(data?.title || spotifyQuery.title || "", {
          title: data?.title || spotifyQuery.title || "",
          artist: "",
          query: data?.title || spotifyQuery.title || ""
        }));

      if (appleMetadata?.artist && !groundTruth?.trustAsCanonical) {
        nextDescription = appleMetadata.artist;
      }
      if ((!nextTitle || isLikelyNonTrackTitle(nextTitle)) && appleMetadata?.title && !groundTruth?.trustAsCanonical) {
        nextTitle = appleMetadata.title;
      }
    }

    const cleanTitle = sanitizeMetadataText(groundTruth?.title || nextTitle, MAX_METADATA_TEXT_LENGTH) || data?.title || "música encontrada";
    let cleanDescription = sanitizeMetadataText(groundTruth?.artist || nextDescription, MAX_METADATA_TEXT_LENGTH, {
      blankWhenNoisy: true
    });
    if (normalizeSearchText(cleanDescription) === normalizeSearchText(cleanTitle)) {
      cleanDescription = "";
    }

    return {
      ...data,
      title: cleanTitle,
      description: cleanDescription,
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

async function enrichWithSecondaryFallbacks(data, groundTruth = {}) {
  let next = { ...(data || {}) };
  const links = Array.isArray(next.links) ? next.links : [];
  const hasMissingArtist = !String(next.description || "").trim();
  const hasMissingTitle = !String(next.title || "").trim();
  const hasMissingImage = !String(next.image || "").trim();
  const hasNoisyTitle = isLikelyNonTrackTitle(next.title || "");

  if (!hasMissingArtist && !hasMissingTitle && !hasMissingImage && !hasNoisyTitle) {
    return next;
  }

  const deezerEntry = links.find(item => String(item?.type || "").toLowerCase() === "deezer" && item?.url);
  if (deezerEntry) {
    const deezerMeta = await fetchDeezerMetadata(deezerEntry.url);
    if (deezerMeta?.artist && !String(next.description || "").trim() && !groundTruth?.trustAsCanonical) {
      next.description = deezerMeta.artist;
    }
    if (deezerMeta?.title && (hasMissingTitle || hasNoisyTitle) && !groundTruth?.trustAsCanonical) {
      next.title = deezerMeta.title;
    }
    if (deezerMeta?.image && !String(next.image || "").trim()) {
      next.image = deezerMeta.image;
    }
  }

  if (!String(next.description || "").trim()) {
    const itunesFallback = await fetchAppleMusicLinkFromItunes(next.title || "", {
      title: next.title || "",
      artist: "",
      query: next.title || ""
    });
    if (itunesFallback?.artist && !groundTruth?.trustAsCanonical) {
      next.description = itunesFallback.artist;
    }
    if (itunesFallback?.title && (hasMissingTitle || hasNoisyTitle) && !groundTruth?.trustAsCanonical) {
      next.title = itunesFallback.title;
    }
  }

  return {
    ...next,
    title: sanitizeMetadataText(groundTruth?.title || next.title, MAX_METADATA_TEXT_LENGTH) || "música encontrada",
    description:
      normalizeSearchText(groundTruth?.title || next.title) === normalizeSearchText(groundTruth?.artist || next.description)
        ? ""
        : sanitizeMetadataText(groundTruth?.artist || next.description, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }),
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

  for (const link of links) {
    const type = String(link?.type || "").trim();
    const url = String(link?.url || "").trim();
    if (!type || !url) continue;

    const canonical = canonicalizeMediaUrl(url);
    const key = type.toLowerCase();
    const current = { ...link, type, url: canonical };
    const existing = byType.get(key);

    if (!existing || isLinkBetter(current, existing)) {
      byType.set(key, current);
    }
  }

  return Array.from(byType.values());
}

function isGenericResultLabel(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return false;
  return (
    normalized === "resultado por busca" ||
    normalized === "resultado de busca" ||
    normalized === "search result" ||
    normalized === "música encontrada" ||
    normalized === "musica encontrada" ||
    normalized === "song found"
  );
}

function pickBestTrackTitle(...candidates) {
  for (const candidate of candidates) {
    const clean = sanitizeMetadataText(candidate, MAX_METADATA_TEXT_LENGTH);
    if (!clean) continue;
    if (isGenericResultLabel(clean)) continue;
    return clean;
  }
  return "";
}

function isLinkBetter(candidate, existing) {
  const cScore = scoreLinkQuality(candidate);
  const eScore = scoreLinkQuality(existing);
  return cScore >= eScore;
}

function scoreLinkQuality(item) {
  const url = String(item?.url || "");
  const key = String(item?.type || "").toLowerCase();
  let score = item?.isVerified ? 20 : 0;
  if (!isSearchLikeUrl(url, key)) score += 10;

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
    artist: entity?.artistName || "",
    description: [entity?.artistName, entity?.albumName].filter(Boolean).join(" • "),
    album: entity?.albumName || "",
    isrc: entity?.isrc || "",
    durationMs: Number(entity?.duration || 0) || 0,
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

  if (value.includes("music.youtube.com") || value.includes("youtube.com/") || value.includes("youtu.be/")) {
    return "youtube";
  }
  if (value.includes("music.apple.com") || value.includes("itunes.apple.com")) return "apple music";
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
