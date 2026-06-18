import { createHmac } from "node:crypto";

import { normalizeSearchText, scoreTextAlignment } from "./music-contract.js";

const SPOTIFY_BASE_URL = "https://open.spotify.com";
const SPOTIFY_PATHFINDER_URL = "https://api-partner.spotify.com/pathfinder/v1/query";
const SEARCH_DESKTOP_HASH = "75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec";
const PLAYER_JS_REGEX = /"(https:\/\/[^" ]+\/(?:mobile-)?web-player\.[0-9a-f]+\.js)"/;
const SECRETS_REGEX = /\{\s*secret\s*:\s*["']([^"']+)["']\s*,\s*version\s*:\s*(\d+)\s*\}/g;
const TOKEN_REFRESH_SKEW_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

let spotifyTokenCache = null;

export async function searchSpotifyWebTrack(query, target = {}) {
  if (process.env.SPOTIFY_WEB_MATCHING_ENABLED === "false") return null;

  const searchTerm = String(query || "").trim();
  if (!searchTerm) return null;

  const accessToken = await getSpotifyAccessToken();
  if (!accessToken) return null;

  const variables = {
    searchTerm,
    offset: 0,
    limit: 4,
    numberOfTopResults: 5
  };
  const extensions = {
    persistedQuery: {
      version: 1,
      sha256Hash: SEARCH_DESKTOP_HASH
    }
  };

  const url = new URL(SPOTIFY_PATHFINDER_URL);
  url.searchParams.set("operationName", "searchDesktop");
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("extensions", JSON.stringify(extensions));

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "app-platform": "WebPlayer"
    }
  });

  if (!response.ok) {
    throw new Error(`spotify web search failed: ${response.status}`);
  }

  const payload = await response.json();
  const search = payload?.data?.searchV2 || payload?.data?.search;
  const candidates = (search?.tracks?.items || [])
    .map(item => item?.track)
    .filter(Boolean)
    .map(track => ({
      title: String(track?.name || "").trim(),
      artist: (track?.artists?.items || []).map(artist => artist?.profile?.name).filter(Boolean).join(", "),
      url: spotifyUriToUrl(track?.uri || "")
    }))
    .filter(candidate => candidate.url);

  if (!candidates.length) return null;

  const scored = candidates
    .map(candidate => ({
      ...candidate,
      score: scoreSpotifyCandidate({ ...target, query: searchTerm }, candidate)
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 45) return null;

  return {
    type: "spotify",
    url: best.url,
    isVerified: best.score >= 78,
    source: "spotify_web",
    title: best.title,
    artist: best.artist,
    score: best.score
  };
}

export function scoreSpotifyCandidate(target, candidate) {
  const targetText = normalizeSearchText([
    target?.title,
    target?.artist,
    target?.query
  ].filter(Boolean).join(" "));
  const candidateText = normalizeSearchText([candidate?.title, candidate?.artist].filter(Boolean).join(" "));

  if (!targetText || !candidateText) return 0;
  if (targetText === candidateText) return 100;

  const targetTokens = new Set(targetText.split(" ").filter(Boolean));
  const candidateTokens = new Set(candidateText.split(" ").filter(Boolean));
  const overlap = [...targetTokens].filter(token => candidateTokens.has(token)).length;
  const union = new Set([...targetTokens, ...candidateTokens]).size || 1;
  const jaccard = overlap / union;
  const alignment = scoreTextAlignment(target, candidate);

  let score = Math.round(jaccard * 55 + alignment * 0.45);
  if (candidateText.includes(normalizeSearchText(target?.title || ""))) score += 10;
  if (candidateText.includes(normalizeSearchText(target?.artist || ""))) score += 8;
  if (/\b(live|karaoke|instrumental|sped|slowed)\b/.test(candidateText) && !/\b(live|karaoke|instrumental|sped|slowed)\b/.test(targetText)) {
    score -= 12;
  }
  return Math.max(0, Math.min(100, score));
}

export async function getSpotifyAccessToken() {
  if (spotifyTokenCache?.accessToken && spotifyTokenCache.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
    return spotifyTokenCache.accessToken;
  }

  const serverTimeResponse = await fetchWithTimeout(`${SPOTIFY_BASE_URL}/api/server-time`, {
    headers: { Accept: "application/json" }
  });
  if (!serverTimeResponse.ok) throw new Error(`spotify server time failed: ${serverTimeResponse.status}`);
  const { serverTime } = await serverTimeResponse.json();

  const htmlResponse = await fetchWithTimeout(SPOTIFY_BASE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/123 Safari/537.36"
    }
  });
  if (!htmlResponse.ok) throw new Error(`spotify homepage failed: ${htmlResponse.status}`);
  const html = await htmlResponse.text();
  const jsUrl = html.match(PLAYER_JS_REGEX)?.[1];
  if (!jsUrl) throw new Error("spotify web player bundle not found");

  const jsResponse = await fetchWithTimeout(jsUrl);
  if (!jsResponse.ok) throw new Error(`spotify web player bundle failed: ${jsResponse.status}`);
  const js = await jsResponse.text();

  let latestVersion = 0;
  let latestSecret = "";
  let match;
  while ((match = SECRETS_REGEX.exec(js)) !== null) {
    const version = Number(match[2]) || 0;
    if (version > latestVersion) {
      latestVersion = version;
      latestSecret = match[1];
    }
  }
  SECRETS_REGEX.lastIndex = 0;
  if (!latestSecret) throw new Error("spotify TOTP secret not found");

  const totp = generateSpotifyTotp(serverTime, latestSecret);
  const tokenUrl = new URL(`${SPOTIFY_BASE_URL}/api/token`);
  tokenUrl.searchParams.set("reason", "init");
  tokenUrl.searchParams.set("productType", "web-player");
  tokenUrl.searchParams.set("totp", totp);
  tokenUrl.searchParams.set("totpVer", String(latestVersion));
  tokenUrl.searchParams.set("ts", String(serverTime));

  const tokenResponse = await fetchWithTimeout(tokenUrl.toString(), {
    headers: {
      Accept: "application/json",
      Origin: SPOTIFY_BASE_URL,
      Referer: `${SPOTIFY_BASE_URL}/`
    }
  });
  if (!tokenResponse.ok) throw new Error(`spotify token failed: ${tokenResponse.status}`);
  const tokenData = await tokenResponse.json();
  if (!tokenData?.accessToken) throw new Error("spotify token missing accessToken");

  spotifyTokenCache = {
    accessToken: tokenData.accessToken,
    expiresAt: Number(tokenData.accessTokenExpirationTimestampMs || 0) || Date.now() + 55 * 60 * 1000
  };
  return spotifyTokenCache.accessToken;
}

export function generateSpotifyTotp(serverTime, secret) {
  const secretArray = Array.from(String(secret || ""), char => char.charCodeAt(0));
  const transformed = secretArray.map((element, index) => element ^ ((index % 33) + 9));
  const hexSecret = Buffer.from(transformed.join(""), "utf8").toString("hex");
  const secretBytes = Buffer.from(hexSecret, "hex");
  const counter = Math.floor(Number(serverTime || 0) / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", secretBytes);
  hmac.update(counterBuffer);
  const hmacResult = hmac.digest();
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  return (code % 10 ** 6).toString().padStart(6, "0");
}

function spotifyUriToUrl(uri) {
  const parts = String(uri || "").split(":");
  if (parts.length < 3 || parts[0] !== "spotify") return "";
  return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
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
