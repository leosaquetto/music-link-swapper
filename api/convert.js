import {
  attachAliasesToTrack,
  readCachedResultByAlias,
  readCachedResultByTrackKey,
  recordProviderAttempt,
  upsertCachedResult
} from "../server/lib/music-library.js";
import {
  buildCanonicalTrackKey,
  buildYoutubePlatformLinks,
  canonicalizeMediaUrl as canonicalizeContractMediaUrl,
  cleanArtistName,
  decorateResultForResponse,
  filterDisplayLinks,
  getBaseTrackTitle,
  getMissingPlatforms,
  isAutomaticPlatform,
  normalizePlatformKey as normalizeContractPlatformKey,
  withYoutubePlatformPairs
} from "../server/lib/music-contract.js";
import { searchSpotifyWebTrack } from "../server/lib/spotify-web.js";
import {
  isStatslcBridgeConfigured,
  searchStatslcBridge
} from "../server/lib/statslc-bridge.js";
import {
  extractDeezerTrackId,
  fetchDeezerTrackById,
  findBestDeezerTrack,
  isDeezerMatchingEnabled
} from "../server/lib/deezer.js";
import {
  isYoutubeDataMatchingConfigured,
  searchYoutubeVideoForTrackWithDiagnostics
} from "../server/lib/youtube-data.js";
import {
  fetchRapidApiMusicDataYoutubeVideo,
  isRapidApiShazamEnabled,
  isRapidApiSpotifyEnabled,
  isRapidApiSpotifyWebApi3Enabled,
  isRapidApiYoutubeMusicEnabled,
  searchRapidApiShazamTrack,
  searchRapidApiSpotifyTrack,
  searchRapidApiSpotifyWebApi3Track,
  searchRapidApiYoutubeMusicTrack
} from "../server/lib/rapidapi-music.js";

const PRIMARY_API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";
const SONGLINK_API_URL = "https://api.song.link/v1-alpha.1/links";
const ITUNES_SEARCH_API_URL = "https://itunes.apple.com/search";
const SPOTIFY_OEMBED_API_URL = "https://open.spotify.com/oembed";
const YOUTUBE_OEMBED_API_URL = "https://www.youtube.com/oembed";
const YOUTUBE_NOEMBED_API_URL = "https://noembed.com/embed";
const YOUTUBE_VIDEOS_API_URL = "https://www.googleapis.com/youtube/v3/videos";
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
const LOCALE_CATALOG_DEFAULTS = new Map([
  ["pt-br", { locale: "pt-BR", countryCode: "BR" }],
  ["en", { locale: "en-US", countryCode: "US" }],
  ["en-us", { locale: "en-US", countryCode: "US" }],
  ["es-es", { locale: "es-ES", countryCode: "ES" }],
  ["it-it", { locale: "it-IT", countryCode: "IT" }],
  ["fr-fr", { locale: "fr-FR", countryCode: "FR" }]
]);

function buildRequestContext({ locale, countryCode } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const localeDefaults = normalizedLocale
    ? LOCALE_CATALOG_DEFAULTS.get(normalizedLocale.toLowerCase()) || { locale: normalizedLocale }
    : {};
  const normalizedCountryCode = normalizeCountryCode(countryCode) || localeDefaults.countryCode || "";

  return {
    locale: localeDefaults.locale || normalizedLocale || "",
    countryCode: normalizedCountryCode
  };
}

function normalizeLocale(value) {
  const raw = String(value || "").trim().replace("_", "-");
  const match = raw.match(/^([a-z]{2})(?:-([a-z]{2}))?$/i);
  if (!match) return "";
  const language = match[1].toLowerCase();
  const region = match[2] ? match[2].toUpperCase() : "";
  return region ? `${language}-${region}` : language;
}

function normalizeCountryCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : "";
}

export default async function handler(req, res) {
  metrics.requests += 1;
  emitMetricsHeartbeat();
  let progressStream = null;

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
    const { link, adapters, queryMode, query, locale, countryCode, stream } = req.body || {};
    progressStream = createConversionProgressStream(res, stream === true && !queryMode);
    const requestContext = buildRequestContext({ locale, countryCode });
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

      const queryCacheKey = buildCanonicalTrackKey({ title: query.trim(), description: "" });
      const cachedByQuery = await readCachedResultByTrackKey(queryCacheKey);
      if (cachedByQuery) {
        return res.status(200).json({ ok: true, data: cachedByQuery });
      }

      const fallbackByQuery = await buildSearchFallbackFromQuery(query.trim(), requestContext);
      if (fallbackByQuery.ok) {
        const data = await finalizeAndPersistResult(fallbackByQuery.data, {
          cacheStatus: "miss",
          aliases: [],
          defaultSource: "query",
          requestContext
        });
        return res.status(200).json({ ok: true, data });
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
    const inputAlias = canonicalizeContractMediaUrl(link);
    const platform = detectPlatformFromUrl(link);
    let inputContext = null;
    const getInputContext = async () => {
      if (!inputContext) {
        inputContext = await buildInputCacheContext(link, platform);
      }
      return inputContext;
    };

    const cachedByAlias = await readCachedResultByAlias(inputAlias);
    if (cachedByAlias) {
      const cacheInputContext = shouldUpgradeCachedResult(cachedByAlias) ? await getInputContext() : null;
      const data = await maybeUpgradeCachedResult(cachedByAlias, {
        aliases: [inputAlias],
        defaultSource: "cache_upgrade",
        inputContext: cacheInputContext,
        requestContext
      });
      return res.status(200).json({ ok: true, data });
    }

    inputContext = await getInputContext();
    if (inputContext.canonicalKey) {
      const cachedByTrack = await readCachedResultByTrackKey(inputContext.canonicalKey);
      if (cachedByTrack) {
        const data = await maybeUpgradeCachedResult(cachedByTrack, {
          aliases: [inputAlias],
          defaultSource: "cache_upgrade",
          inputContext,
          requestContext
        });
        if (data?.trackId) {
          await attachAliasesToTrack(data.trackId, [inputAlias]);
        }
        return res.status(200).json({ ok: true, data });
      }
    }

    if (sampleCacheKey) {
      const cachedResult = readSampleResultCache(sampleCacheKey);
      if (cachedResult) {
        const data = decorateResultForResponse(cachedResult, { cacheStatus: "hit" });
        return res.status(200).json({ ok: true, data });
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
      const finalizedData = await finalizeResultData(groundedData, requestContext, progressStream.emit);
      const data = await finalizeAndPersistResult(finalizedData, {
        cacheStatus: "miss",
        aliases: [inputAlias],
        defaultSource: "provider",
        inputContext
      });
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, data, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return sendConversionSuccess(res, data, progressStream);
    }

    const fallbackResult = shouldUseSongLinkFirst
      ? await fetchPrimaryApi(link, adapters)
      : await fetchSongLinkAsFallback(link);

    if (fallbackResult.ok) {
      const groundedData = await enforceInputTrackGroundTruth(fallbackResult.data, link);
      const finalizedData = await finalizeResultData(groundedData, requestContext, progressStream.emit);
      const data = await finalizeAndPersistResult(finalizedData, {
        cacheStatus: "miss",
        aliases: [inputAlias],
        defaultSource: "provider",
        inputContext
      });
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, data, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return sendConversionSuccess(res, data, progressStream);
    }

    if (platform === "spotify") {
      const spotifyFallback = await buildSpotifySearchFallback(link, requestContext);
      if (spotifyFallback.ok) {
        const groundedData = await enforceInputTrackGroundTruth(spotifyFallback.data, link);
        const finalizedData = await finalizeResultData(groundedData, requestContext, progressStream.emit);
        const data = await finalizeAndPersistResult(finalizedData, {
          cacheStatus: "miss",
          aliases: [inputAlias],
          defaultSource: "spotify_web",
          inputContext
        });
        if (sampleCacheKey) {
          writeSampleResultCache(sampleCacheKey, data, SAMPLE_RESULT_CACHE_TTL_MS);
        }
        return sendConversionSuccess(res, data, progressStream);
      }
    }

    const directInputFallback = buildDirectInputFallback(link, inputContext);
    if (directInputFallback.ok) {
      const finalizedData = await finalizeResultData(directInputFallback.data, requestContext, progressStream.emit);
      const data = await finalizeAndPersistResult(finalizedData, {
        cacheStatus: "miss",
        aliases: [inputAlias],
        defaultSource: "input",
        inputContext
      });
      if (sampleCacheKey) {
        writeSampleResultCache(sampleCacheKey, data, SAMPLE_RESULT_CACHE_TTL_MS);
      }
      return sendConversionSuccess(res, data, progressStream);
    }

    return res.status(primaryResult.status || 502).json({
      ok: false,
      error: buildFriendlyPlatformError(platform, primaryResult.error || fallbackResult.error)
    });
  } catch (_error) {
    metrics.errors += 1;
    if (progressStream?.started) {
      return progressStream.fail("erro interno ao converter");
    }
    return res.status(500).json({
      ok: false,
      error: "erro interno ao converter"
    });
  } finally {
    releaseInFlightSlot();
  }
}

function createConversionProgressStream(res, enabled = false) {
  let started = false;
  let lastSignature = "";

  const start = () => {
    if (!enabled || typeof res?.write !== "function") return false;
    if (started) return true;
    res.status?.(200);
    res.setHeader?.("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader?.("Cache-Control", "no-cache, no-transform");
    res.setHeader?.("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    started = true;
    return true;
  };

  const writeEvent = event => {
    if (!start()) return false;
    res.write(`${JSON.stringify(event)}\n`);
    return true;
  };

  return {
    get enabled() {
      return enabled;
    },
    get started() {
      return started;
    },
    emit(data) {
      if (!enabled || !data) return;
      const partial = decorateResultForResponse(data, { cacheStatus: "partial" });
      const signature = JSON.stringify({
        title: partial.title,
        description: partial.description,
        image: partial.image,
        links: (partial.links || []).map(item => `${item.type}:${item.url}`)
      });
      if (signature === lastSignature) return;
      lastSignature = signature;
      writeEvent({ type: "progress", data: partial });
    },
    complete(data) {
      if (!started) return false;
      res.write(`${JSON.stringify({ type: "complete", data })}\n`);
      res.end();
      return true;
    },
    fail(error) {
      if (!started) return false;
      res.write(`${JSON.stringify({ type: "error", error })}\n`);
      res.end();
      return true;
    }
  };
}

function sendConversionSuccess(res, data, progressStream) {
  if (progressStream?.complete(data)) return;
  return res.status(200).json({ ok: true, data });
}

async function buildSpotifySearchFallback(link, requestContext = {}) {
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

    const [appleMusicResult, deezerResult] = await Promise.all([
      fetchAppleMusicLinkFromItunes(normalizedQuery.query, normalizedQuery),
      findBestDeezerTrack(normalizedQuery).catch(() => null)
    ]);
    const baseLinks = buildSearchLinksFromQuery(normalizedQuery.query, link, appleMusicResult, deezerResult);
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
      {
        title: deezerResult?.title || "",
        description: deezerResult?.artist || "",
        album: deezerResult?.album || "",
        image: metadata.image || deezerResult?.image || "",
        isrc: deezerResult?.isrc || ""
      }
    );

    const successResult = {
      ok: true,
      status: 200,
      data: await finalizeResultData(
        {
          ...metadataPayload,
          links
        },
        requestContext
      )
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

async function buildSearchFallbackFromQuery(query, requestContext = {}) {
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

  const [appleMusicResult, deezerResult] = await Promise.all([
    fetchAppleMusicLinkFromItunes(normalizedQuery.query, normalizedQuery),
    findBestDeezerTrack(normalizedQuery).catch(() => null)
  ]);
  const baseLinks = buildSearchLinksFromQuery(normalizedQuery.query, "", appleMusicResult, deezerResult).filter(
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
    primaryFromApple.ok ? primaryFromApple.data : songLinkFromApple.ok ? songLinkFromApple.data : {},
    {
      title: deezerResult?.title || "",
      description: deezerResult?.artist || "",
      album: deezerResult?.album || "",
      image: deezerResult?.image || "",
      isrc: deezerResult?.isrc || ""
    }
  );

  return {
    ok: true,
    status: 200,
    data: await finalizeResultData(
      {
        ...metadataPayload,
        links
      },
      requestContext
    )
  };
}

async function buildInputCacheContext(link, platform) {
  const alias = canonicalizeContractMediaUrl(link);
  const platformKey = normalizeContractPlatformKey(platform);
  const context = {
    alias,
    title: "",
    artist: "",
    album: "",
    image: "",
    isrc: "",
    durationMs: 0,
    canonicalKey: ""
  };

  try {
    if (platformKey === "spotify") {
      const metadata = await fetchSpotifyMetadata(link);
      const spotifyQuery = buildSpotifyQueryFromMetadata(metadata);
      context.title = spotifyQuery.title || metadata?.title || "";
      context.artist = spotifyQuery.artist || "";
      context.image = metadata?.image || "";
    } else if (platformKey === "youtube" || platformKey === "youtubeMusic") {
      const metadata = await fetchYoutubeMetadata(link);
      context.title = metadata?.title || "";
      context.artist = metadata?.artist || "";
      context.image = metadata?.image || "";
    } else if (platformKey === "deezer") {
      const trackId = extractDeezerTrackId(link);
      const metadata = trackId ? await fetchDeezerTrackById(trackId) : null;
      context.title = metadata?.title || "";
      context.artist = metadata?.artist || "";
      context.album = metadata?.album || "";
      context.image = metadata?.image || "";
      context.isrc = metadata?.isrc || "";
      context.durationMs = Number(metadata?.duration || 0) * 1000;
    } else {
      const appleTrack = extractAppleTrackInputContext(link);
      if (appleTrack.trackId) {
        const appleMetadata = await fetchAppleTrackMetadataById(appleTrack.trackId);
        context.title = appleMetadata?.title || "";
        context.artist = appleMetadata?.artist || "";
        context.album = appleMetadata?.album || "";
        context.image = appleMetadata?.image || "";
        context.durationMs = Number(appleMetadata?.durationMs || 0) || 0;
      }
    }
  } catch (_error) {
    return context;
  }

  context.canonicalKey = buildCanonicalTrackKey(context);
  return context;
}

function buildDirectInputFallback(link, inputContext = {}) {
  const platform = detectAutomaticInputPlatform(link);
  if (!platform) {
    return {
      ok: false,
      status: 404,
      error: "link direto fora da promessa automática"
    };
  }

  return {
    ok: true,
    status: 200,
    data: {
      title: inputContext?.title || "música encontrada",
      description: inputContext?.artist || "",
      album: inputContext?.album || "",
      image: inputContext?.image || "",
      durationMs: Number(inputContext?.durationMs || 0) || 0,
      links: [
        {
          type: platform,
          url: link,
          isVerified: true,
          source: "input"
        }
      ]
    }
  };
}

async function finalizeAndPersistResult(data, options = {}) {
  const {
    cacheStatus = "miss",
    aliases = [],
    defaultSource = "provider",
    inputContext = null
  } = options;

  const withInputContext = applyInputContextToResult(data, inputContext);
  const responseData = decorateResultForResponse(withInputContext, { cacheStatus });
  const persisted = await upsertCachedResult(responseData, { aliases, defaultSource });
  if (persisted?.trackId) {
    responseData.trackId = persisted.trackId;
  }
  return responseData;
}

async function maybeUpgradeCachedResult(cachedData, { aliases = [], defaultSource = "cache_upgrade", inputContext = null, requestContext = {} } = {}) {
  if (!shouldUpgradeCachedResult(cachedData)) return cachedData;

  try {
    const upgradeInput = prepareCachedResultForUpgrade(cachedData, inputContext);
    const finalizedData = await finalizeResultData(upgradeInput, requestContext);
    if (!isCachedUpgradeUseful(cachedData, finalizedData)) return cachedData;

    const withInputContext = applyInputContextToResult(finalizedData, inputContext);
    const responseData = decorateResultForResponse(withInputContext, {
      cacheStatus: "hit",
      trackId: cachedData?.trackId || ""
    });
    const persistData = prepareCachedUpgradeForPersist(responseData, defaultSource);
    const persisted = await upsertCachedResult(persistData, { aliases, defaultSource });
    if (persisted?.trackId) {
      responseData.trackId = persisted.trackId;
    }
    return responseData;
  } catch (error) {
    console.warn("[music-link-swapper] cached upgrade failed", error?.message || error);
    return cachedData;
  }
}

function prepareCachedResultForUpgrade(cachedData, inputContext) {
  return applyInputContextToResult(cachedData, inputContext);
}

function shouldUpgradeCachedResult(data) {
  const missingPlatforms = Array.isArray(data?.missingPlatforms)
    ? data.missingPlatforms
    : getMissingPlatforms(data?.links || []);
  if (!missingPlatforms.length) return false;
  if (pickSongLinkEnrichmentCandidate(data?.links || [], missingPlatforms)) return true;

  return missingPlatforms.some(platform => {
    if (platform === "youtube" || platform === "youtubeMusic") {
      return isYoutubeDataMatchingConfigured() || isRapidApiYoutubeMusicEnabled();
    }
    if (platform === "deezer") return isDeezerMatchingEnabled();
    if (platform === "spotify") return true;
    return platform === "appleMusic";
  });
}

function isCachedUpgradeUseful(before, after) {
  const beforeLinks = filterDisplayLinks(before?.links || []);
  const afterLinks = filterDisplayLinks(after?.links || []);
  if (afterLinks.length > beforeLinks.length) return true;
  return getMissingPlatforms(afterLinks).length < getMissingPlatforms(beforeLinks).length;
}

function prepareCachedUpgradeForPersist(data, defaultSource) {
  return {
    ...data,
    links: (Array.isArray(data?.links) ? data.links : []).map(link => (
      String(link?.source || "").toLowerCase() === "cache"
        ? { ...link, source: defaultSource }
        : link
    ))
  };
}

function applyInputContextToResult(data, inputContext) {
  if (!inputContext) return data;
  const currentTitle = String(data?.title || "").trim();
  const inputTitle = String(inputContext.title || "").trim();
  const currentDescription = String(data?.description || "").trim();
  const inputArtist = String(inputContext.artist || "").trim();

  return {
    ...(data || {}),
    title: shouldPreferInputTitle(currentTitle, inputTitle) ? inputTitle : currentTitle,
    description: shouldPreferInputDescription(currentDescription, inputArtist, currentTitle, inputTitle) ? inputArtist : currentDescription,
    album: data?.album || inputContext.album || "",
    image: data?.image || inputContext.image || "",
    isrc: data?.isrc || inputContext.isrc || "",
    durationMs: Number(data?.durationMs || inputContext.durationMs || 0) || 0,
    links: Array.isArray(data?.links) ? data.links : []
  };
}

function shouldPreferInputTitle(currentTitle, inputTitle) {
  if (!inputTitle) return false;
  if (!currentTitle) return true;
  return (
    isGenericTrackTitle(currentTitle) ||
    isNoisyMetadataText(currentTitle) ||
    isLikelyNonTrackTitle(currentTitle)
  );
}

function shouldPreferInputDescription(currentDescription, inputArtist, currentTitle = "", inputTitle = "") {
  if (!inputArtist) return false;
  if (!currentDescription) return true;
  if (inputTitle && isGenericTrackTitle(currentTitle)) return true;
  return isNoisyMetadataText(currentDescription);
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

async function fetchYoutubeMetadata(link) {
  const videoId = getYoutubeVideoId(link);
  if (!videoId) return { title: "", artist: "", image: "" };

  const canonicalWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoints = [
    `${YOUTUBE_OEMBED_API_URL}?url=${encodeURIComponent(canonicalWatchUrl)}&format=json`,
    `${YOUTUBE_NOEMBED_API_URL}?url=${encodeURIComponent(canonicalWatchUrl)}`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; music-link-swapper/1.0)"
          }
        }
      );
      if (!response.ok) continue;

      const payload = await response.json();
      const metadata = youtubeOEmbedPayloadToMetadata(payload);
      if (metadata.title || metadata.artist || metadata.image) return metadata;
    } catch (_error) {
      continue;
    }
  }

  try {
    const musicDataMetadata = await fetchRapidApiMusicDataYoutubeVideo(videoId);
    if (musicDataMetadata?.title || musicDataMetadata?.artist || musicDataMetadata?.image) {
      return {
        title: sanitizeYoutubeOEmbedTitle(musicDataMetadata.title || musicDataMetadata.rawTitle || ""),
        artist: sanitizeYoutubeOEmbedAuthor(musicDataMetadata.artist || ""),
        image: musicDataMetadata.image || ""
      };
    }
  } catch (_error) {
    // Keep the YouTube Data API fallback available when RapidAPI is unavailable.
  }

  const youtubeDataMetadata = await fetchYoutubeDataApiMetadata(videoId);
  if (youtubeDataMetadata.title || youtubeDataMetadata.artist || youtubeDataMetadata.image) {
    return youtubeDataMetadata;
  }

  return { title: "", artist: "", image: "" };
}

function youtubeOEmbedPayloadToMetadata(payload) {
  return {
    title: sanitizeYoutubeOEmbedTitle(payload?.title || ""),
    artist: sanitizeYoutubeOEmbedAuthor(payload?.author_name || ""),
    image: payload?.thumbnail_url || ""
  };
}

async function fetchYoutubeDataApiMetadata(videoId) {
  if (!isYoutubeDataMatchingConfigured()) return { title: "", artist: "", image: "" };

  try {
    const apiKey = String(process.env.YOUTUBE_API_KEY || "").trim();
    const url = new URL(YOUTUBE_VIDEOS_API_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", videoId);

    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) return { title: "", artist: "", image: "" };

    const payload = await response.json();
    const item = Array.isArray(payload?.items) ? payload.items[0] : null;
    const snippet = item?.snippet || {};
    const thumbnails = snippet?.thumbnails || {};
    const image =
      thumbnails.maxres?.url ||
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.default?.url ||
      "";

    return {
      title: sanitizeYoutubeOEmbedTitle(snippet.title || ""),
      artist: sanitizeYoutubeOEmbedAuthor(snippet.channelTitle || ""),
      image
    };
  } catch (_error) {
    return { title: "", artist: "", image: "" };
  }
}

function sanitizeYoutubeOEmbedTitle(value) {
  return String(value || "")
    .replace(/\s+-\s+topic$/i, "")
    .replace(/\s+\(official\s+(audio|music video|video)\)$/i, "")
    .replace(/\s+\[(official\s+)?(audio|music video|video)]$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeYoutubeOEmbedAuthor(value) {
  return String(value || "")
    .replace(/\s+-\s+topic$/i, "")
    .replace(/\s+vevo$/i, "")
    .replace(/\s+/g, " ")
    .trim();
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
  if (!query) return { url: "", isVerified: false, artist: "", title: "", album: "", source: "itunes" };

  try {
    const attempts = buildItunesSearchAttempts(query, normalizedQuery);
    let target = { candidate: null, score: 0 };

    for (const attempt of attempts) {
      const response = await fetchWithTimeout(
        `${ITUNES_SEARCH_API_URL}?term=${encodeURIComponent(attempt.query)}&entity=song&limit=8`
      );

      if (!response.ok) continue;

      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      if (!results.length) continue;

      const attemptTarget = findBestMatch(results, {
        query: attempt.scoreQuery,
        title: attempt.title,
        artist: attempt.artist,
        type: "song",
        getCandidateText: item => `${item?.trackName || ""} ${item?.artistName || ""}`,
        getCandidateKind: item => item?.kind || "",
        getCandidateArtist: item => item?.artistName || "",
        getCandidateTitle: item => item?.trackName || ""
      });
      if (attemptTarget.score > target.score) {
        target = attemptTarget;
      }
      if (target.score >= 85) break;
    }

    if (!target?.candidate) return { url: "", isVerified: false, artist: "", title: "", album: "", source: "itunes" };

    return {
      url: target?.candidate?.trackViewUrl || "",
      isVerified: target.score >= 72,
      artist: target?.candidate?.artistName || "",
      title: target?.candidate?.trackName || "",
      album: target?.candidate?.collectionName || "",
      durationMs: Number(target?.candidate?.trackTimeMillis || 0) || 0,
      source: "itunes"
    };
  } catch (_error) {
    return { url: "", isVerified: false, artist: "", title: "", album: "", source: "itunes" };
  }
}

function buildItunesSearchAttempts(query, normalizedQuery = {}) {
  const title = String(normalizedQuery?.title || "").trim();
  const artist = String(normalizedQuery?.artist || "").trim();
  const cleanTitle = simplifyTrackTitleForSearch(title);
  const attempts = [
    {
      query: String(query || "").trim(),
      scoreQuery: String(query || "").trim(),
      title,
      artist
    }
  ];

  if (cleanTitle && artist) {
    attempts.push({
      query: [artist, cleanTitle, title.toLowerCase().includes("live") ? "live" : ""].filter(Boolean).join(" "),
      scoreQuery: [artist, cleanTitle, title.toLowerCase().includes("live") ? "live" : ""].filter(Boolean).join(" "),
      title: cleanTitle,
      artist
    });
  }

  const seen = new Set();
  return attempts.filter(attempt => {
    const key = normalizeSearchText(attempt.query);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function simplifyTrackTitleForSearch(value) {
  return String(value || "")
    .replace(/\s+\((?:live\s+)?at\s+[^)]*\)/gi, " live")
    .replace(/\s+\[(?:live\s+)?at\s+[^\]]*]/gi, " live")
    .replace(/\s*,\s*\d{1,2}\/\d{1,2}\/\d{2,4}/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function buildSearchLinksFromQuery(_query, originalSpotifyUrl, appleMusicResult, deezerResult = null) {
  const appleMusicUrl = appleMusicResult?.url || "";
  const appleMusicIsVerified = Boolean(appleMusicResult?.isVerified);
  const deezerUrl = deezerResult?.url || "";

  const links = [
    originalSpotifyUrl
      ? {
          type: "spotify",
          url: originalSpotifyUrl,
          isVerified: true,
          source: "input"
        }
      : null,
    appleMusicUrl
      ? {
          type: "appleMusic",
          url: appleMusicUrl,
          isVerified: appleMusicIsVerified,
          source: "itunes"
        }
      : null,
    deezerUrl
      ? {
          type: "deezer",
          url: deezerUrl,
          isVerified: Boolean(deezerResult?.isVerified),
          source: "deezer_api"
        }
      : null
  ];

  return links.filter(item => item?.url);
}

function pickBestMetadata(baseData, enrichedData, fallback = {}) {
  const base = baseData || {};
  const enriched = enrichedData || {};
  return {
    title: enriched.title || base.title || fallback.title || "música encontrada",
    description: enriched.description || base.description || fallback.description || "",
    album: enriched.album || base.album || fallback.album || "",
    image: enriched.image || base.image || fallback.image || "",
    isrc: enriched.isrc || base.isrc || fallback.isrc || "",
    durationMs: Number(enriched.durationMs || base.durationMs || fallback.durationMs || 0) || 0,
    universalLink: enriched.universalLink || base.universalLink || fallback.universalLink || ""
  };
}

async function finalizeResultData(data, requestContext = {}, onProgress = null) {
  const payload = data || {};
  const normalizedLinks = dedupeAndNormalizeLinks(Array.isArray(payload.links) ? payload.links : []);
  const youtubeAdjustedLinks = withYoutubePlatformPairs(refineYoutubePlatformsWithCandidates(normalizedLinks, payload));
  const imageFromLinks = pickImageFromLinks(normalizedLinks);
  const base = {
    ...payload,
    title: sanitizeMetadataText(payload.title, MAX_METADATA_TEXT_LENGTH) || "música encontrada",
    description: sanitizeMetadataText(payload.description, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }),
    album: sanitizeMetadataText(payload.album, MAX_METADATA_TEXT_LENGTH),
    image: payload.image || imageFromLinks || "",
    links: youtubeAdjustedLinks
  };
  emitConversionProgress(onProgress, base);

  const spotifyEnriched = await runEnrichmentStep(base, enrichWithSpotifyFallback, onProgress);
  const secondaryEnriched = await runEnrichmentStep(spotifyEnriched, enrichWithSecondaryFallbacks, onProgress);
  const deezerEnriched = await runEnrichmentStep(secondaryEnriched, enrichWithDeezerMatch, onProgress);
  const statslcEnriched = await runEnrichmentStep(deezerEnriched, enrichWithStatslcBridge, onProgress);
  const spotifyWebEnriched = await runEnrichmentStep(statslcEnriched, enrichWithSpotifyWebMatch, onProgress);
  const rapidSpotifyEnriched = await runEnrichmentStep(spotifyWebEnriched, value => enrichWithRapidApiSpotifyMatch(value, requestContext), onProgress);
  const postSpotifyStatslcEnriched = await runEnrichmentStep(rapidSpotifyEnriched, enrichWithStatslcBridge, onProgress);
  const postSpotifyWebFallbackEnriched = await runEnrichmentStep(postSpotifyStatslcEnriched, enrichWithSpotifyFallback, onProgress);
  const postSpotifyDeezerEnriched = await runEnrichmentStep(postSpotifyWebFallbackEnriched, enrichWithDeezerMatch, onProgress);
  const shazamAppleEnriched = await runEnrichmentStep(postSpotifyDeezerEnriched, value => enrichWithRapidApiShazamAppleMusic(value, requestContext), onProgress);
  const appleBridgeEnriched = await runEnrichmentStep(shazamAppleEnriched, enrichWithAppleBridgeFallback, onProgress);
  const postAppleDeezerEnriched = await runEnrichmentStep(appleBridgeEnriched, enrichWithDeezerMatch, onProgress);
  const songLinkEnriched = await runEnrichmentStep(postAppleDeezerEnriched, enrichWithSongLinkDirectLinks, onProgress);
  const youtubePaired = {
    ...songLinkEnriched,
    links: withYoutubePlatformPairs(Array.isArray(songLinkEnriched?.links) ? songLinkEnriched.links : [])
  };
  emitConversionProgress(onProgress, youtubePaired);
  const youtubeDataEnriched = await runEnrichmentStep(youtubePaired, value => enrichWithYoutubeDataMatch(value, requestContext), onProgress);
  return runEnrichmentStep(youtubeDataEnriched, value => enrichWithRapidApiYoutubeMusicMatch(value, requestContext), onProgress);
}

async function runEnrichmentStep(data, enrich, onProgress) {
  const next = await enrich(data);
  emitConversionProgress(onProgress, next);
  return next;
}

function emitConversionProgress(onProgress, data) {
  if (typeof onProgress !== "function") return;
  try {
    onProgress(data);
  } catch (_error) {}
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

  return null;
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
  if (directArtist && !isWeakArtistText(directArtist)) return cleanArtistName(directArtist);

  const description = String(payload?.description || "").trim();
  if (!description) return "";

  const firstChunk = description
    .split(/•|\||-|\n/)
    .map(item => item.trim())
    .find(Boolean);

  if (!firstChunk) return "";
  if (isNoisyMetadataText(normalizeSearchText(firstChunk))) return "";
  if (isWeakArtistText(firstChunk)) return "";
  return cleanArtistName(firstChunk);
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
  const requiresBridge = ["spotify", "youtube", "youtubemusic"].some(
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

  return {
    ...data,
    links: dedupeAndNormalizeLinks(nextLinks)
  };
}

async function enrichWithSongLinkDirectLinks(data) {
  const next = { ...(data || {}) };
  const links = dedupeAndNormalizeLinks(Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : []);
  const missing = getMissingPlatforms(links);
  if (!missing.length) return { ...next, links };

  const candidate = pickSongLinkEnrichmentCandidate(links, missing);
  if (!candidate?.url) return { ...next, links };

  const startedAt = Date.now();
  const title = String(next.title || "").trim();
  const artist = extractArtistFromPayload(next);
  const trackKey = buildCanonicalTrackKey({ title, artist, isrc: next.isrc });
  try {
    const result = await fetchSongLink(candidate.url, { markVerified: true });
    await recordProviderAttempt({
      trackKey,
      provider: "songlink_enrichment",
      status: result.ok ? "hit" : "miss",
      latencyMs: Date.now() - startedAt,
      message: result.ok
        ? (result.data?.links || []).map(item => item.type).join(",")
        : result.error || "no_match"
    });

    if (!result.ok) return { ...next, links };

    const merged = mergeLinkResults({ ...next, links }, result.data);
    return {
      ...next,
      title: next.title || result.data?.title || "música encontrada",
      description: next.description || result.data?.description || "",
      album: next.album || result.data?.album || "",
      image: next.image || result.data?.image || "",
      links: dedupeAndNormalizeLinks(merged.links)
    };
  } catch (error) {
    await recordProviderAttempt({
      trackKey,
      provider: "songlink_enrichment",
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "unknown_error")
    });
    return { ...next, links };
  }
}

function pickSongLinkEnrichmentCandidate(links, missing) {
  const missingSet = new Set((Array.isArray(missing) ? missing : []).map(item => normalizeContractPlatformKey(item)));
  const canEnrichFromNonSpotify = missingSet.size > 0;

  const candidates = (Array.isArray(links) ? links : [])
    .map(item => ({
      ...item,
      type: normalizeContractPlatformKey(item?.type || "")
    }))
    .filter(item => {
      if (!item?.url || isSearchLikeUrl(item.url, item.type)) return false;
      if (String(item.source || "").toLowerCase() === "songlink") return false;
      if (item.type === "spotify") return missingSet.size > 0;
      if (!canEnrichFromNonSpotify) return false;
      return item.type === "appleMusic" || item.type === "youtube" || item.type === "youtubeMusic";
    })
    .sort((left, right) => songLinkEnrichmentPriority(right, missingSet) - songLinkEnrichmentPriority(left, missingSet));

  return candidates[0] || null;
}

function songLinkEnrichmentPriority(item, missingSet) {
  const type = normalizeContractPlatformKey(item?.type || "");
  let score = 0;
  if (type === "spotify") score += 100;
  if (type === "appleMusic") score += 55;
  if (type === "youtubeMusic") score += 35;
  if (type === "youtube") score += 30;
  if (type === "spotify" && missingSet.has("appleMusic")) score += 20;
  if (type === "spotify" && (missingSet.has("youtube") || missingSet.has("youtubeMusic"))) score += 18;
  if (type === "spotify" && missingSet.has("deezer")) score += 14;
  if (item?.isVerified) score += 10;
  if (item?.source === "input" || item?.source === "cache") score += 8;
  return score;
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

function isGenericTrackTitle(value) {
  const normalized = normalizeSearchText(value);
  return normalized === "musica encontrada" || normalized === "track found";
}

function isWeakArtistText(value) {
  const normalized = normalizeSearchText(value);
  return (
    normalized === "resultado por busca" ||
    normalized === "search result" ||
    normalized === "result by search"
  );
}

async function enrichWithSpotifyFallback(data) {
  const links = Array.isArray(data?.links) ? data.links.map(item => ({ ...item })) : [];
  const spotifyEntry = links.find(item => String(item?.type || "").toLowerCase() === "spotify" && item?.url);
  if (!spotifyEntry) return { ...data, links };

  try {
    let spotifyMeta = {};
    try {
      spotifyMeta = await fetchSpotifyMetadata(spotifyEntry.url);
    } catch (_error) {
      spotifyMeta = {};
    }
    const spotifyQuery = buildSpotifyQueryFromMetadata(spotifyMeta);
    const shouldUseSpotifyText =
      !data?.description ||
      isNoisyMetadataText(String(data.description || "").toLowerCase()) ||
      isWeakArtistText(data.description);

    let nextTitle = data?.title || "";
    let nextDescription = data?.description || "";
    let nextImage = data?.image || "";

    if ((shouldUseSpotifyText || String(nextDescription).length > 80) && spotifyQuery.artist) {
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

    const payloadAppleTitle =
      !isNoisyMetadataText(String(nextTitle || "").toLowerCase()) && !isLikelyNonTrackTitle(nextTitle)
        ? String(nextTitle || "").trim()
        : "";
    const payloadAppleArtist = extractArtistFromPayload({ ...data, description: nextDescription });
    const fallbackAppleTitle = payloadAppleTitle || spotifyQuery.title || "";
    const fallbackAppleArtist = payloadAppleArtist || spotifyQuery.artist || "";
    const appleQuery = {
      title: fallbackAppleTitle,
      artist: fallbackAppleArtist,
      query: [fallbackAppleTitle, fallbackAppleArtist].filter(Boolean).join(" ").trim()
    };

    const hasWeakAppleMusicLinkIndex = links.findIndex(item => {
      const type = normalizeContractPlatformKey(item?.type || "");
      if (type !== "appleMusic") return false;
      const url = String(item?.url || "");
      return /\/artist\//.test(url) || url.includes("geo.music.apple.com");
    });
    const hasDirectAppleMusicLink = links.some(item => {
      const type = normalizeContractPlatformKey(item?.type || "");
      if (type !== "appleMusic") return false;
      const url = String(item?.url || "");
      if (!url || isSearchLikeUrl(url, "appleMusic")) return false;
      return !/\/artist\//.test(url) && !url.includes("geo.music.apple.com");
    });

    const queryForApple = appleQuery.query || spotifyQuery.query;
    const hasReliableAppleQuery = Boolean(appleQuery.title && appleQuery.artist);
    let appleMusicFallbackMetadata = null;
    if (queryForApple && hasReliableAppleQuery && (!hasDirectAppleMusicLink || hasWeakAppleMusicLinkIndex !== -1)) {
      const appleMusicResult = await fetchAppleMusicLinkFromItunes(queryForApple, appleQuery);
      appleMusicFallbackMetadata = appleMusicResult;
      if (appleMusicResult?.url && appleMusicResult.isVerified) {
        const appleMusicLink = {
          ...(hasWeakAppleMusicLinkIndex !== -1 ? links[hasWeakAppleMusicLinkIndex] : {}),
          type: "appleMusic",
          url: canonicalizeMediaUrl(appleMusicResult.url),
          isVerified: true,
          source: "itunes"
        };
        if (hasWeakAppleMusicLinkIndex !== -1) {
          links[hasWeakAppleMusicLinkIndex] = appleMusicLink;
        } else {
          links.push(appleMusicLink);
        }
      }
    }

    if (!nextDescription || isWeakArtistText(nextDescription)) {
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
  const hasMissingArtist = !String(next.description || "").trim();
  const hasMissingTitle = !String(next.title || "").trim();
  const hasMissingImage = !String(next.image || "").trim();
  const hasNoisyTitle = isLikelyNonTrackTitle(next.title || "");

  if (!hasMissingArtist && !hasMissingTitle && !hasMissingImage && !hasNoisyTitle) {
    return next;
  }

  const deezerEntry = links.find(item => String(item?.type || "").toLowerCase() === "deezer" && item?.url);
  if (deezerEntry) {
    const deezerMeta = await fetchDeezerMetadataFromLink(deezerEntry.url);
    if (deezerMeta?.artist && !String(next.description || "").trim()) {
      next.description = deezerMeta.artist;
    }
    if (deezerMeta?.title && (hasMissingTitle || hasNoisyTitle)) {
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

async function enrichWithDeezerMatch(data) {
  const next = { ...(data || {}) };
  const links = dedupeAndNormalizeLinks(Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : []);
  const hasDirectDeezer = links.some(item => {
    const type = normalizeContractPlatformKey(item?.type || "");
    return type === "deezer" && item?.url && !isSearchLikeUrl(item.url, type);
  });

  if (hasDirectDeezer || !isDeezerMatchingEnabled()) return { ...next, links };

  const title = String(next.title || "").trim();
  const artist = extractArtistFromPayload(next);
  const query = [title, artist].filter(Boolean).join(" ").trim();
  if (!title || !artist || !query) return { ...next, links };

  const startedAt = Date.now();
  const trackKey = buildCanonicalTrackKey({ title, artist, isrc: next.isrc });
  try {
    const match = await findBestDeezerTrack({
      query,
      title,
      artist,
      album: next.album || "",
      durationMs: Number(next.durationMs || next.duration || 0) || 0,
      isrc: next.isrc
    });

    await recordProviderAttempt({
      trackKey,
      provider: "deezer_api",
      status: match?.url ? "hit" : "miss",
      latencyMs: Date.now() - startedAt,
      message: match?.url ? `${match.url} score=${Math.round(Number(match.score || 0))}` : "no_match"
    });

    if (!match?.url) return { ...next, links };

    return {
      ...next,
      title: sanitizeMetadataText(next.title || match.title, MAX_METADATA_TEXT_LENGTH) || next.title || match.title || "música encontrada",
      description: sanitizeMetadataText(next.description || match.artist, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }),
      album: next.album || match.album || "",
      image: next.image || match.image || "",
      isrc: next.isrc || match.isrc || "",
      durationMs: Number(next.durationMs || 0) || Number(match.duration || 0) * 1000,
      links: dedupeAndNormalizeLinks([
        ...links,
        {
          type: "deezer",
          url: match.url,
          isVerified: Boolean(match.isVerified),
          source: "deezer_api"
        }
      ])
    };
  } catch (error) {
    await recordProviderAttempt({
      trackKey,
      provider: "deezer_api",
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "unknown_error")
    });
    return { ...next, links };
  }
}

async function enrichWithStatslcBridge(data) {
  const next = { ...(data || {}) };
  const links = dedupeAndNormalizeLinks(Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : []);
  const missing = getMissingPlatforms(links);
  const canHelp = missing.includes("spotify") || missing.includes("appleMusic");
  if (!canHelp || !isStatslcBridgeConfigured()) return { ...next, links };

  const title = String(next.title || "").trim();
  const artist = extractArtistFromPayload(next);
  const query = [title, artist].filter(Boolean).join(" ").trim();
  const spotifyId = extractSpotifyTrackIdFromLinks(links);
  const appleMusicId = extractAppleMusicTrackIdFromLinks(links);
  const statsfmTrackId = String(next.statsfmTrackId || next.statsfmId || "").trim();
  if (!query && !spotifyId && !appleMusicId && !statsfmTrackId) return { ...next, links };

  const startedAt = Date.now();
  const trackKey = buildCanonicalTrackKey({ title, artist, isrc: next.isrc });
  try {
    const match = await searchStatslcBridge({
      query,
      title,
      artist,
      durationMs: Number(next.durationMs || next.duration || 0) || 0,
      spotifyId,
      appleMusicId,
      statsfmTrackId,
      isrc: next.isrc
    });

    await recordProviderAttempt({
      trackKey,
      provider: "statslc_bridge",
      status: match?.links?.length ? "hit" : "miss",
      latencyMs: Date.now() - startedAt,
      message: match?.links?.map(item => item.type).join(",") || "no_match"
    });

    if (!match?.links?.length) return { ...next, links };

    const bridgeLinks = await normalizeStatslcBridgeLinks(match.links, next);
    if (!bridgeLinks.length) return { ...next, links };

    const bridgeTrack = match.track || {};
    return {
      ...next,
      title: sanitizeMetadataText(next.title || bridgeTrack.title, MAX_METADATA_TEXT_LENGTH) || next.title || bridgeTrack.title || "música encontrada",
      description: sanitizeMetadataText(next.description || bridgeTrack.artist, MAX_METADATA_TEXT_LENGTH, { blankWhenNoisy: true }),
      image: next.image || bridgeTrack.image || "",
      links: dedupeAndNormalizeLinks([
        ...links,
        ...bridgeLinks
      ])
    };
  } catch (error) {
    await recordProviderAttempt({
      trackKey,
      provider: "statslc_bridge",
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "unknown_error")
    });
    return { ...next, links };
  }
}

async function normalizeStatslcBridgeLinks(links, data) {
  const out = [];
  for (const link of Array.isArray(links) ? links : []) {
    const type = normalizeContractPlatformKey(link?.type || "");
    if (type === "spotify") {
      const spotifyId = extractSpotifyTrackId(link?.url) || extractSpotifyTrackId(link?.id);
      if (spotifyId) {
        out.push({
          type: "spotify",
          url: `https://open.spotify.com/track/${spotifyId}`,
          isVerified: Boolean(link?.isVerified),
          source: "statslc_bridge"
        });
      }
      continue;
    }

    if (type === "appleMusic") {
      const appleLink = await resolveStatslcAppleMusicLink(link, data);
      if (appleLink?.url) out.push(appleLink);
    }
  }
  return out;
}

async function resolveStatslcAppleMusicLink(link, data) {
  const directUrl = String(link?.url || "").trim();
  if (filterDisplayLinks([{ type: "appleMusic", url: directUrl }]).length) {
    return {
      type: "appleMusic",
      url: canonicalizeMediaUrl(directUrl),
      isVerified: Boolean(link?.isVerified),
      source: "statslc_bridge"
    };
  }

  const appleMusicId = extractAppleMusicTrackId(directUrl) || extractAppleMusicTrackId(link?.id);
  if (!appleMusicId) return null;

  const metadata = await fetchAppleTrackMetadataById(appleMusicId);
  if (!metadata?.url) return null;

  const targetTitle = String(data?.title || "").trim();
  const targetArtist = extractArtistFromPayload(data);
  const score = scoreTextAlignment(
    { title: targetTitle || metadata.title, artist: targetArtist || metadata.artist },
    { title: metadata.title, artist: metadata.artist }
  );

  return {
    type: "appleMusic",
    url: canonicalizeMediaUrl(metadata.url),
    isVerified: Boolean(link?.isVerified) && score >= 72,
    source: "statslc_bridge"
  };
}

async function enrichWithSpotifyWebMatch(data) {
  const next = { ...(data || {}) };
  const links = Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : [];
  const hasDirectSpotify = links.some(item => {
    const type = String(item?.type || "").toLowerCase();
    return type === "spotify" && item?.url && !isSearchLikeUrl(item.url, type);
  });
  if (hasDirectSpotify) return { ...next, links };

  const title = String(next.title || "").trim();
  const artist = cleanArtistName(extractArtistFromPayload(next));
  const attempts = buildSpotifyWebMatchAttempts({ title, artist });
  if (!attempts.length) return { ...next, links };

  const startedAt = Date.now();
  const trackKey = buildCanonicalTrackKey({ title, artist });
  try {
    let match = null;
    for (const attempt of attempts) {
      match = await searchSpotifyWebTrack(attempt.query, {
        title: attempt.title,
        artist: attempt.artist,
        query: attempt.query
      });
      if (match?.url) break;
    }
    await recordProviderAttempt({
      trackKey,
      provider: "spotify_web",
      status: match?.url ? "hit" : "miss",
      latencyMs: Date.now() - startedAt,
      message: match?.url || "no_match"
    });

    if (!match?.url) return { ...next, links };

    return {
      ...next,
      links: dedupeAndNormalizeLinks([
        ...links,
        {
          type: "spotify",
          url: match.url,
          isVerified: Boolean(match.isVerified),
          source: "spotify_web"
        }
      ])
    };
  } catch (error) {
    await recordProviderAttempt({
      trackKey,
      provider: "spotify_web",
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "unknown_error")
    });
    return { ...next, links };
  }
}

function buildSpotifyWebMatchAttempts({ title, artist }) {
  const originalTitle = String(title || "").trim();
  const cleanArtist = cleanArtistName(artist);
  const baseTitle = getBaseTrackTitle(originalTitle);
  const artistForSearch = cleanArtist.replace(/\s*&\s*/g, " ");
  const attempts = [
    {
      query: [originalTitle, cleanArtist].filter(Boolean).join(" ").trim(),
      title: originalTitle,
      artist: cleanArtist
    },
    {
      query: [baseTitle, artistForSearch].filter(Boolean).join(" ").trim(),
      title: baseTitle || originalTitle,
      artist: cleanArtist
    }
  ];

  const seen = new Set();
  return attempts.filter(attempt => {
    const key = normalizeSearchText(attempt.query);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function enrichWithRapidApiSpotifyMatch(data, requestContext = {}) {
  const next = { ...(data || {}) };
  const links = Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : [];
  const hasDirectSpotify = links.some(item => {
    const type = String(item?.type || "").toLowerCase();
    return type === "spotify" && item?.url && !isSearchLikeUrl(item.url, type);
  });
  if (hasDirectSpotify || (!isRapidApiSpotifyEnabled() && !isRapidApiSpotifyWebApi3Enabled())) return { ...next, links };

  const title = String(next.title || "").trim();
  const artist = extractArtistFromPayload(next);
  const query = [title, artist].filter(Boolean).join(" ").trim();
  if (!title || !artist || !query) return { ...next, links };

  const trackKey = buildCanonicalTrackKey({ title, artist });
  const request = {
    query,
    title,
    artist,
    album: next.album || "",
    durationMs: Number(next.durationMs || next.duration || 0) || 0,
    countryCode: requestContext.countryCode || "",
    locale: requestContext.locale || ""
  };
  const providers = [
    {
      enabled: isRapidApiSpotifyEnabled(),
      provider: "rapidapi_spotify23",
      search: searchRapidApiSpotifyTrack
    },
    {
      enabled: isRapidApiSpotifyWebApi3Enabled(),
      provider: "rapidapi_spotify_web_api3",
      search: searchRapidApiSpotifyWebApi3Track
    }
  ];

  for (const provider of providers) {
    if (!provider.enabled) continue;
    const startedAt = Date.now();
    try {
      const match = await provider.search(request);
      await recordProviderAttempt({
        trackKey,
        provider: provider.provider,
        status: match?.url ? "hit" : "miss",
        latencyMs: Date.now() - startedAt,
        message: match?.url ? `${match.url} score=${Math.round(Number(match.score || 0))}` : "no_match"
      });

      if (!match?.url) continue;

      return {
        ...next,
        links: dedupeAndNormalizeLinks([
          ...links,
          {
            type: "spotify",
            url: match.url,
            isVerified: Boolean(match.isVerified),
            source: match.source || provider.provider
          }
        ])
      };
    } catch (error) {
      await recordProviderAttempt({
        trackKey,
        provider: provider.provider,
        status: "error",
        latencyMs: Date.now() - startedAt,
        message: String(error?.message || error || "unknown_error")
      });
    }
  }

  return { ...next, links };
}

async function enrichWithRapidApiShazamAppleMusic(data, requestContext = {}) {
  const next = { ...(data || {}) };
  const links = dedupeAndNormalizeLinks(Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : []);
  const hasDirectAppleMusic = links.some(item => {
    const type = normalizeContractPlatformKey(item?.type || "");
    const url = String(item?.url || "");
    if (type !== "appleMusic" || !url || isSearchLikeUrl(url, type)) return false;
    return !/\/artist\//.test(url) && !url.includes("geo.music.apple.com");
  });
  if (hasDirectAppleMusic || !isRapidApiShazamEnabled()) return { ...next, links };

  const title = String(next.title || "").trim();
  const artist = extractArtistFromPayload(next);
  const query = [title, artist].filter(Boolean).join(" ").trim();
  if (!title || !artist || !query) return { ...next, links };

  const startedAt = Date.now();
  const trackKey = buildCanonicalTrackKey({ title, artist });
  try {
    const match = await searchRapidApiShazamTrack({
      query,
      title,
      artist,
      album: next.album || "",
      durationMs: Number(next.durationMs || next.duration || 0) || 0,
      countryCode: requestContext.countryCode || "",
      locale: requestContext.locale || ""
    });

    let appleUrl = match?.appleMusicUrl || "";
    let appleMetadata = null;
    if (!appleUrl && match?.appleMusicTrackId) {
      appleMetadata = await fetchAppleTrackMetadataById(match.appleMusicTrackId);
      appleUrl = appleMetadata?.url || "";
    }

    await recordProviderAttempt({
      trackKey,
      provider: "rapidapi_shazam",
      status: appleUrl ? "hit" : "miss",
      latencyMs: Date.now() - startedAt,
      message: appleUrl ? `${appleUrl} score=${Math.round(Number(match?.score || 0))}` : "no_match"
    });

    if (!appleUrl) return { ...next, links };

    const titleCandidate =
      (!isGenericTrackTitle(next.title) && !isLikelyNonTrackTitle(next.title))
        ? next.title
        : match?.title || appleMetadata?.title || next.title;
    const descriptionCandidate =
      extractArtistFromPayload(next) || match?.artist || appleMetadata?.artist || "";

    return {
      ...next,
      title: sanitizeMetadataText(titleCandidate, MAX_METADATA_TEXT_LENGTH) || next.title || match?.title || "música encontrada",
      description: sanitizeMetadataText(
        descriptionCandidate,
        MAX_METADATA_TEXT_LENGTH,
        { blankWhenNoisy: true }
      ),
      album: sanitizeMetadataText(next.album || appleMetadata?.album || match?.album, MAX_METADATA_TEXT_LENGTH),
      image: next.image || match?.image || appleMetadata?.image || "",
      links: dedupeAndNormalizeLinks([
        ...links,
        {
          type: "appleMusic",
          url: canonicalizeMediaUrl(appleUrl),
          isVerified: Boolean(match?.isVerified),
          source: "rapidapi_shazam"
        }
      ])
    };
  } catch (error) {
    await recordProviderAttempt({
      trackKey,
      provider: "rapidapi_shazam",
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "unknown_error")
    });
    return { ...next, links };
  }
}

async function enrichWithYoutubeDataMatch(data, requestContext = {}) {
  const next = { ...(data || {}) };
  const links = withYoutubePlatformPairs(Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : []);
  const hasDirectYoutube = links.some(item => {
    const type = normalizeContractPlatformKey(item?.type || "");
    return (type === "youtube" || type === "youtubeMusic") && getYoutubeVideoId(item?.url || "") && !isSearchLikeUrl(item.url, type);
  });

  if (hasDirectYoutube || !isYoutubeDataMatchingConfigured()) {
    return { ...next, links };
  }

  const title = String(next.title || "").trim();
  const artist = extractArtistFromPayload(next);
  const query = [title, artist].filter(Boolean).join(" ").trim();
  if (!title || !artist || !query) return { ...next, links };

  const startedAt = Date.now();
  const trackKey = buildCanonicalTrackKey({ title, artist });
  try {
    const youtubeResult = await searchYoutubeVideoForTrackWithDiagnostics(query, {
      title,
      artist,
      durationMs: Number(next.durationMs || next.duration || 0) || 0,
      countryCode: requestContext.countryCode || "",
      locale: requestContext.locale || ""
    });
    const match = youtubeResult?.match || null;

    await recordProviderAttempt({
      trackKey,
      provider: "youtube_api",
      status: match?.videoId ? "hit" : "miss",
      latencyMs: Date.now() - startedAt,
      message: formatYoutubeProviderMessage(match, youtubeResult?.diagnostics)
    });

    if (!match?.videoId) return { ...next, links };

    return {
      ...next,
      links: dedupeAndNormalizeLinks([
        ...links,
        ...buildYoutubePlatformLinks(match.videoId, {
          source: "youtube_api",
          isVerified: Boolean(match.isVerified)
        })
      ])
    };
  } catch (error) {
    await recordProviderAttempt({
      trackKey,
      provider: "youtube_api",
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "unknown_error")
    });
    return { ...next, links };
  }
}

async function enrichWithRapidApiYoutubeMusicMatch(data, requestContext = {}) {
  const next = { ...(data || {}) };
  const links = withYoutubePlatformPairs(Array.isArray(next.links) ? next.links.map(item => ({ ...item })) : []);
  const hasDirectYoutube = links.some(item => {
    const type = normalizeContractPlatformKey(item?.type || "");
    return (type === "youtube" || type === "youtubeMusic") && getYoutubeVideoId(item?.url || "") && !isSearchLikeUrl(item.url, type);
  });

  if (hasDirectYoutube || !isRapidApiYoutubeMusicEnabled()) {
    return { ...next, links };
  }

  const title = String(next.title || "").trim();
  const artist = extractArtistFromPayload(next);
  const query = [title, artist].filter(Boolean).join(" ").trim();
  if (!title || !artist || !query) return { ...next, links };

  const startedAt = Date.now();
  const trackKey = buildCanonicalTrackKey({ title, artist });
  try {
    const match = await searchRapidApiYoutubeMusicTrack({
      query,
      title,
      artist,
      album: next.album || "",
      durationMs: Number(next.durationMs || next.duration || 0) || 0,
      countryCode: requestContext.countryCode || "",
      locale: requestContext.locale || ""
    });
    await recordProviderAttempt({
      trackKey,
      provider: "rapidapi_youtube_music_api3",
      status: match?.videoId ? "hit" : "miss",
      latencyMs: Date.now() - startedAt,
      message: match?.videoId ? `${match.videoId} score=${Math.round(Number(match.score || 0))}` : "no_match"
    });

    if (!match?.videoId) return { ...next, links };

    return {
      ...next,
      links: dedupeAndNormalizeLinks([
        ...links,
        ...(Array.isArray(match.links) ? match.links : [])
      ])
    };
  } catch (error) {
    await recordProviderAttempt({
      trackKey,
      provider: "rapidapi_youtube_music_api3",
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: String(error?.message || error || "unknown_error")
    });
    return { ...next, links };
  }
}

function formatYoutubeProviderMessage(match, diagnostics = {}) {
  const pass = match?.pass || diagnostics?.lastPass || "strict";
  const passDiagnostics = diagnostics?.[pass] || {};
  const candidateCount = Number(passDiagnostics.candidateCount || match?.candidateCount || 0) || 0;
  const bestScore = Number(passDiagnostics.bestScore || match?.score || 0) || 0;
  const prefix = match?.url || "no_match";
  return `${prefix} pass=${pass} candidates=${candidateCount} best=${bestScore}`;
}

async function fetchDeezerMetadataFromLink(url) {
  try {
    const trackId = extractDeezerTrackId(url);
    const track = trackId ? await fetchDeezerTrackById(trackId) : null;
    return {
      title: String(track?.title || "").trim(),
      artist: String(track?.artist || "").trim(),
      album: String(track?.album || "").trim(),
      image: String(track?.image || "").trim(),
      isrc: String(track?.isrc || "").trim()
    };
  } catch (_error) {
    return { title: "", artist: "", album: "", image: "", isrc: "" };
  }
}

function dedupeAndNormalizeLinks(links) {
  const byType = new Map();
  const seenCanonical = new Set();

  for (const link of links) {
    const type = normalizeContractPlatformKey(link?.type || "").trim();
    const url = String(link?.url || "").trim();
    if (!type || !url) continue;

    const canonical = canonicalizeMediaUrl(url);
    if (!filterDisplayLinks([{ ...link, type, url: canonical }]).length) continue;
    if (seenCanonical.has(canonical)) continue;

    const key = type.toLowerCase();
    const current = { ...link, type, url: canonical, source: link?.source || "unknown" };
    const existing = byType.get(key);

    if (!existing || isLinkBetter(current, existing)) {
      byType.set(key, current);
      seenCanonical.add(canonical);
    }
  }

  return withYoutubePlatformPairs(Array.from(byType.values()));
}

function isLinkBetter(candidate, existing) {
  const cScore = scoreLinkQuality(candidate);
  const eScore = scoreLinkQuality(existing);
  return cScore >= eScore;
}

function scoreLinkQuality(item) {
  const url = String(item?.url || "");
  const key = String(item?.type || "").toLowerCase();
  const source = String(item?.source || "").toLowerCase();
  let score = item?.isVerified ? 20 : 0;
  if (!isSearchLikeUrl(url, key)) score += 10;
  if (source === "input") score += 30;
  if (source === "manual") score += 24;
  if (source === "statslc_bridge") score += 20;
  if (source === "itunes") score += 18;
  if (source === "spotify_web") score += 12;
  if (source === "rapidapi_spotify23") score += 11;
  if (source === "rapidapi_spotify_web_api3") score += 11;
  if (source === "rapidapi_shazam") score += 10;
  if (source === "deezer_api") score += 12;
  if (source === "rapidapi_youtube_music_api3") score += 10;
  if (source === "songlink") score += 4;

  if (key === "applemusic" || key === "itunes") {
    if (/\/album\/.+\?i=\d+/.test(url)) score += 20;
    if (/\/artist\//.test(url)) score -= 15;
    if (url.includes("geo.music.apple.com")) score -= 18;
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

    if (host.includes("deezer.com")) {
      const trackId = extractDeezerTrackId(url.toString());
      if (trackId) return `https://www.deezer.com/track/${trackId}`;
    }

    url.hash = "";
    return url.toString();
  } catch (_error) {
    return String(value || "").trim();
  }
}

async function enforceInputTrackGroundTruth(data, sourceLink) {
  const sourcePlatform = detectAutomaticInputPlatform(sourceLink);
  if (sourcePlatform && sourcePlatform !== "appleMusic") {
    return {
      ...(data || {}),
      links: dedupeAndNormalizeLinks([
        {
          type: sourcePlatform,
          url: sourceLink,
          isVerified: true,
          source: "input"
        },
        ...(Array.isArray(data?.links) ? data.links : [])
      ])
    };
  }

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
    durationMs: Number(appleTrackMetadata?.durationMs || data?.durationMs || 0) || 0,
    links: dedupeAndNormalizeLinks([
      {
        type: "appleMusic",
        url: sourceAppleTrack.url,
        isVerified: true,
        source: "input"
      },
      ...filtered
    ])
  };
}

function detectAutomaticInputPlatform(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    const host = parsed.hostname.toLowerCase();
    if (host.includes("open.spotify.com") && parsed.pathname.includes("/track/")) return "spotify";
    if (host.includes("music.apple.com") && parsed.searchParams.has("i")) return "appleMusic";
    if (host.includes("deezer.com") && extractDeezerTrackId(parsed.toString())) return "deezer";
    if (host.includes("music.youtube.com") && getYoutubeVideoId(parsed.toString())) return "youtubeMusic";
    if ((host.includes("youtube.com") || host.includes("youtu.be")) && getYoutubeVideoId(parsed.toString())) return "youtube";
    return "";
  } catch (_error) {
    return "";
  }
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
      url: String(firstSong?.trackViewUrl || "").trim(),
      title: String(firstSong?.trackName || "").trim(),
      artist: String(firstSong?.artistName || "").trim(),
      album: String(firstSong?.collectionName || "").trim(),
      image: String(firstSong?.artworkUrl100 || firstSong?.artworkUrl60 || "").trim(),
      durationMs: Number(firstSong?.trackTimeMillis || 0) || 0
    };
  } catch (_error) {
    return null;
  }
}

function extractSpotifyTrackIdFromLinks(links) {
  for (const link of Array.isArray(links) ? links : []) {
    const id = extractSpotifyTrackId(link?.url || link?.id);
    if (id) return id;
  }
  return "";
}

function extractSpotifyTrackId(value) {
  const raw = String(value || "").trim();
  if (/^[A-Za-z0-9]{22}$/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    if (!parsed.hostname.toLowerCase().includes("open.spotify.com")) return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    const trackIndex = parts.findIndex(part => part === "track");
    const id = trackIndex !== -1 ? parts[trackIndex + 1] : "";
    return /^[A-Za-z0-9]{22}$/.test(id) ? id : "";
  } catch (_error) {
    return "";
  }
}

function extractAppleMusicTrackIdFromLinks(links) {
  for (const link of Array.isArray(links) ? links : []) {
    const id = extractAppleMusicTrackId(link?.url || link?.id);
    if (id) return id;
  }
  return "";
}

function extractAppleMusicTrackId(value) {
  const raw = String(value || "").trim();
  if (/^\d{5,}$/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    if (!parsed.hostname.toLowerCase().includes("music.apple.com")) return "";
    const queryTrackId = parsed.searchParams.get("i") || "";
    if (/^\d{5,}$/.test(queryTrackId)) return queryTrackId;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const songIndex = parts.findIndex(part => part === "song");
    const id = songIndex !== -1 ? parts.slice(songIndex + 1).find(part => /^\d{5,}$/.test(part)) : "";
    return /^\d{5,}$/.test(id) ? id : "";
  } catch (_error) {
    return "";
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
      data: withLinkSource(data, "idhs")
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
      const type = normalizeContractPlatformKey(mapSongLinkPlatform(platform));
      if (!isAutomaticPlatform(type)) return null;

      return {
        type,
        url,
        isVerified: markVerified,
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

function withLinkSource(data, source) {
  return {
    ...(data || {}),
    links: Array.isArray(data?.links)
      ? data.links.map(item => ({ ...item, source: item?.source || source }))
      : []
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
  if (value.includes("music.apple.com") || value.includes("itunes.apple.com")) return "apple music";
  if (value.includes("deezer.com")) return "deezer";
  if (value.includes("music.youtube.com")) return "youtube music";
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  if (value.includes("soundcloud.")) return "soundcloud";
  if (value.includes("pandora.")) return "pandora";
  if (value.includes("qobuz.")) return "qobuz";
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

    const bestCandidate = isLinkBetter(item, existing) ? item : existing;
    byType.set(key, {
      ...bestCandidate,
      isVerified: Boolean(existing?.isVerified || item?.isVerified || bestCandidate?.isVerified)
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
  if (key === "qobuz") return lower.includes("qobuz.com") && lower.includes("/search");
  if (key === "amazonmusic" || key === "amazonstore") return lower.includes("music.amazon.com/search");
  if (key === "applemusic" || key === "itunes") return lower.includes("music.apple.com") && lower.includes("/search");

  return /[?&](q|query|search_query|term)=/.test(lower) && lower.includes("search");
}

export const __testHooks = {
  buildInputCacheContext,
  buildDirectInputFallback,
  createConversionProgressStream,
  prepareCachedResultForUpgrade,
  finalizeResultData,
  enrichWithDeezerMatch,
  enrichWithSongLinkDirectLinks,
  enrichWithSpotifyFallback,
  buildSpotifyWebMatchAttempts,
  enrichWithRapidApiSpotifyMatch,
  enrichWithRapidApiShazamAppleMusic,
  enrichWithRapidApiYoutubeMusicMatch,
  normalizeSongLinkPayload
};
