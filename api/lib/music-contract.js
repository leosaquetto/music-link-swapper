import { createHash } from "node:crypto";

export const AUTOMATIC_PLATFORM_KEYS = ["spotify", "appleMusic", "deezer", "youtube", "youtubeMusic"];

const AUTOMATIC_PLATFORM_SET = new Set(AUTOMATIC_PLATFORM_KEYS.map(key => key.toLowerCase()));

export function normalizePlatformKey(key) {
  const raw = String(key || "").trim();
  const normalized = raw.toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");
  if (!normalized) return "";
  if (compact === "apple" || compact === "itunes" || compact === "applemusic") return "appleMusic";
  if (compact === "youtubemusic") return "youtubeMusic";
  if (normalized === "youtube" || normalized === "youtu") return "youtube";
  if (normalized === "spotify") return "spotify";
  if (normalized === "deezer") return "deezer";
  if (normalized === "soundcloud") return "soundCloud";
  if (compact === "amazon" || compact === "amazonmusic") return "amazonMusic";
  return raw;
}

export function isAutomaticPlatform(key) {
  return AUTOMATIC_PLATFORM_SET.has(normalizePlatformKey(key).toLowerCase());
}

export function canonicalizeMediaUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();

    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      const videoId = url.pathname.replace("/", "").trim();
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }

    if (host.includes("youtube.com")) {
      const videoId = url.searchParams.get("v") || "";
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

    if (host.includes("open.spotify.com")) {
      url.search = "";
      url.hash = "";
      return url.toString();
    }

    if (host.includes("deezer.com")) {
      const trackId = extractDeezerTrackId(url.toString());
      if (trackId) return `https://www.deezer.com/track/${trackId}`;
      url.search = "";
      url.hash = "";
      return url.toString();
    }

    url.hash = "";
    return url.toString();
  } catch (_error) {
    return String(value || "").trim();
  }
}

export function isSearchLikeUrl(url, platform = "") {
  const lower = String(url || "").toLowerCase();
  const key = normalizePlatformKey(platform).toLowerCase();
  if (!lower) return false;
  if (key === "spotify") return lower.includes("open.spotify.com/search");
  if (key === "applemusic") return lower.includes("music.apple.com") && lower.includes("/search");
  if (key === "youtube") return lower.includes("/results?search_query=") || lower.includes("youtube.com/search");
  if (key === "youtubemusic") return lower.includes("music.youtube.com/search");
  if (key === "deezer") return lower.includes("deezer.com/search");
  return /[?&](q|query|search_query|term)=/.test(lower) && lower.includes("search");
}

export function getYoutubeVideoId(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host.endsWith(".youtu.be")) return url.pathname.replace("/", "").trim();
    if (host.includes("youtube.com")) return url.searchParams.get("v") || "";
    return "";
  } catch (_error) {
    return "";
  }
}

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value) {
  return normalizeSearchText(value)
    .split(" ")
    .filter(Boolean)
    .filter(token => !new Set(["a", "as", "o", "os", "the", "of", "de", "da", "do", "and", "feat", "featuring", "ft"]).has(token));
}

export function splitArtistCredits(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const normalizedFull = normalizeSearchText(raw);
  const credits = raw
    .split(/\s*(?:,|&|;|\bfeat(?:uring)?\.?\b|\bft\.?\b)\s*/i)
    .map(normalizeSearchText)
    .filter(Boolean);

  return Array.from(new Set([normalizedFull, ...credits].filter(Boolean)));
}

export function isArtistCreditMatch(targetArtist, candidateArtist) {
  const target = normalizeSearchText(targetArtist);
  const candidate = normalizeSearchText(candidateArtist);
  if (!target || !candidate) return false;
  if (target === candidate) return true;

  const targetCredits = new Set(splitArtistCredits(targetArtist));
  const candidateCredits = splitArtistCredits(candidateArtist)
    .filter(credit => credit !== candidate);

  if (targetCredits.has(candidate)) return true;
  return candidateCredits.length > 0 && candidateCredits.every(credit => targetCredits.has(credit));
}

export function getPrimaryArtistCredit(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/\s*(?:,|&|;|\bfeat(?:uring)?\.?\b|\bft\.?\b)\s*/i)
    .map(credit => credit.trim())
    .find(Boolean) || raw;
}

export function buildCanonicalTrackKey(data) {
  const title = normalizeSearchText(data?.title || data?.trackName || "");
  const artist = normalizeSearchText(data?.artist || data?.artistName || data?.description || "").split(" ").slice(0, 8).join(" ");
  const isrc = normalizeSearchText(data?.isrc || "");
  if (isrc) return `isrc:${isrc}`;
  if (!title && !artist) return "";
  return `track:${title}|artist:${artist}`;
}

export function buildTrackId(canonicalKey) {
  const key = String(canonicalKey || "").trim() || "unknown";
  return `trk_${createHash("sha1").update(key).digest("hex").slice(0, 20)}`;
}

export function scoreTextAlignment(target, candidate) {
  const targetTitleTokens = tokenize(target?.title || "");
  const targetArtistTokens = tokenize(target?.artist || "");
  const candidateText = normalizeSearchText([
    candidate?.title,
    candidate?.artist,
    candidate?.description
  ].filter(Boolean).join(" "));

  if (!candidateText) return 0;

  let score = 0;
  const scoreTokens = (tokens, fullPoints, partialPoints) => {
    if (!tokens.length) return;
    const matches = tokens.filter(token => candidateText.includes(token)).length;
    const ratio = matches / tokens.length;
    if (ratio >= 0.85) score += fullPoints;
    else if (ratio >= 0.5) score += partialPoints;
    else score -= partialPoints;
  };

  scoreTokens(targetTitleTokens, 45, 18);
  scoreTokens(targetArtistTokens, 35, 14);
  return Math.max(0, Math.min(100, score));
}

export function filterDisplayLinks(links) {
  const byPlatform = new Map();

  for (const item of Array.isArray(links) ? links : []) {
    const platform = normalizePlatformKey(item?.type || item?.platform);
    const url = canonicalizeMediaUrl(item?.url || "");
    if (!platform || !url || item?.notAvailable) continue;
    if (!isAutomaticPlatform(platform)) continue;
    if (isSearchLikeUrl(url, platform)) continue;

    const candidate = {
      type: platform,
      url,
      isVerified: Boolean(item?.isVerified),
      source: String(item?.source || "unknown")
    };

    const existing = byPlatform.get(platform);
    if (!existing || scoreLinkQuality(candidate) >= scoreLinkQuality(existing)) {
      byPlatform.set(platform, candidate);
    }
  }

  return withYoutubePlatformPairs(Array.from(byPlatform.values())).sort(
    (a, b) => AUTOMATIC_PLATFORM_KEYS.indexOf(a.type) - AUTOMATIC_PLATFORM_KEYS.indexOf(b.type)
  );
}

export function buildYoutubePlatformLinks(videoId, { source = "youtube_api", isVerified = false } = {}) {
  const id = String(videoId || "").trim();
  if (!id) return [];
  return [
    {
      type: "youtube",
      url: `https://www.youtube.com/watch?v=${id}`,
      isVerified: Boolean(isVerified),
      source
    },
    {
      type: "youtubeMusic",
      url: `https://music.youtube.com/watch?v=${id}`,
      isVerified: Boolean(isVerified),
      source
    }
  ];
}

export function withYoutubePlatformPairs(links) {
  const next = (Array.isArray(links) ? links : [])
    .map(item => ({
      ...item,
      type: normalizePlatformKey(item?.type || item?.platform),
      url: canonicalizeMediaUrl(item?.url || "")
    }))
    .filter(item => item.type && item.url);

  const youtubeCandidates = next.filter(item => {
    const type = normalizePlatformKey(item.type);
    return (type === "youtube" || type === "youtubeMusic") && getYoutubeVideoId(item.url) && !isSearchLikeUrl(item.url, type);
  });

  if (!youtubeCandidates.length) return next;

  const best = youtubeCandidates.reduce((winner, current) => (
    scoreLinkQuality(current) >= scoreLinkQuality(winner) ? current : winner
  ));
  const videoId = getYoutubeVideoId(best.url);
  if (!videoId) return next;

  const present = new Set(next.map(item => normalizePlatformKey(item.type)));
  const source = String(best.source || "youtube_api");
  const generated = buildYoutubePlatformLinks(videoId, {
    source,
    isVerified: Boolean(best.isVerified)
  }).filter(item => !present.has(item.type));

  return [...next, ...generated];
}

export function getMissingPlatforms(links) {
  const present = new Set(filterDisplayLinks(links).map(item => item.type));
  return AUTOMATIC_PLATFORM_KEYS.filter(key => !present.has(key));
}

export function decorateResultForResponse(data, { cacheStatus = "miss", trackId = "" } = {}) {
  const links = filterDisplayLinks(data?.links || []);
  const canonicalKey = buildCanonicalTrackKey(data);
  const resolvedTrackId = trackId || buildTrackId(canonicalKey);
  const missingPlatforms = getMissingPlatforms(links);

  return {
    ...(data || {}),
    title: String(data?.title || "música encontrada").trim() || "música encontrada",
    description: String(data?.description || "").trim(),
    album: String(data?.album || "").trim(),
    image: String(data?.image || "").trim(),
    links,
    trackId: resolvedTrackId,
    cacheStatus: cacheStatus === "hit" && missingPlatforms.length ? "partial" : cacheStatus,
    missingPlatforms
  };
}

export function validatePlatformUrl(platform, url) {
  const key = normalizePlatformKey(platform);
  const value = canonicalizeMediaUrl(url);
  if (!isAutomaticPlatform(key) || !value || isSearchLikeUrl(value, key)) return { ok: false, platform: key, url: value };

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const ok =
      (key === "spotify" && host.includes("open.spotify.com") && parsed.pathname.includes("/track/")) ||
      (key === "appleMusic" && host.includes("music.apple.com") && parsed.searchParams.has("i")) ||
      (key === "deezer" && host.includes("deezer.com") && Boolean(extractDeezerTrackId(value))) ||
      (key === "youtube" && (host.includes("youtube.com") || host.includes("youtu.be")) && Boolean(getYoutubeVideoId(value))) ||
      (key === "youtubeMusic" && host.includes("music.youtube.com") && Boolean(getYoutubeVideoId(value)));
    return { ok, platform: key, url: value };
  } catch (_error) {
    return { ok: false, platform: key, url: value };
  }
}

function scoreLinkQuality(item) {
  let score = item?.isVerified ? 20 : 0;
  const platform = normalizePlatformKey(item?.type);
  const url = String(item?.url || "");
  if (!isSearchLikeUrl(url, platform)) score += 20;
  if (item?.source === "input") score += 12;
  if (item?.source === "manual") score += 10;
  if (item?.source === "statslc_bridge") score += 9;
  if (item?.source === "spotify_web") score += 8;
  if (item?.source === "rapidapi_spotify23") score += 8;
  if (item?.source === "rapidapi_spotify_web_api3") score += 8;
  if (item?.source === "rapidapi_shazam") score += 8;
  if (item?.source === "deezer_api") score += 8;
  if (item?.source === "youtube_api") score += 8;
  if (item?.source === "rapidapi_youtube_music_api3") score += 7;
  if (platform === "appleMusic" && /\/album\/.+\?i=\d+/.test(url)) score += 18;
  if (platform === "appleMusic" && url.includes("geo.music.apple.com")) score -= 18;
  if ((platform === "youtube" || platform === "youtubeMusic") && getYoutubeVideoId(url)) score += 12;
  return score;
}

function extractDeezerTrackId(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    if (!host.includes("deezer.com")) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    const trackIndex = parts.findIndex(part => part.toLowerCase() === "track");
    const id = trackIndex !== -1 ? parts[trackIndex + 1] : "";
    return /^\d+$/.test(id) ? id : "";
  } catch (_error) {
    return "";
  }
}
