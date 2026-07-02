#!/usr/bin/env node
import { performance } from "node:perf_hooks";

import { findBestDeezerTrack } from "../server/lib/deezer.js";
import {
  fetchRapidApiMusicDataYoutubeVideo,
  isRapidApiMusicDataEnabled,
  isRapidApiShazamEnabled,
  isRapidApiSpotifyEnabled,
  isRapidApiSpotifyWebApi3Enabled,
  isRapidApiYoutubeMusicEnabled,
  searchRapidApiShazamTrack,
  searchRapidApiSpotifyTrack,
  searchRapidApiSpotifyWebApi3Track,
  searchRapidApiYoutubeMusicTrack
} from "../server/lib/rapidapi-music.js";
import { searchSpotifyWebTrack } from "../server/lib/spotify-web.js";
import { searchYoutubeVideoForTrack } from "../server/lib/youtube-data.js";

const ITUNES_SEARCH_API_URL = "https://itunes.apple.com/search";
const SONGLINK_API_URL = "https://api.song.link/v1-alpha.1/links";
const IDHS_API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";

const fixtures = [
  { title: "One More Time", artist: "Daft Punk", inputUrl: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV" },
  { title: "BIRDS OF A FEATHER", artist: "Billie Eilish" },
  { title: "Saturn", artist: "SZA" },
  { title: "TEXAS HOLD 'EM", artist: "Beyonce" },
  { title: "Not Like Us", artist: "Kendrick Lamar" },
  { title: "Envolver", artist: "Anitta" },
  { title: "Caju", artist: "Liniker" },
  { title: "Sozinho", artist: "Caetano Veloso" },
  { title: "Construcao", artist: "Chico Buarque" },
  { title: "Chega de Saudade", artist: "Joao Gilberto" },
  { title: "Sao Amores", artist: "Pabllo Vittar" },
  { title: "Maquina do Tempo", artist: "Matuê" },
  { title: "Evidencias", artist: "Chitaozinho & Xororo" },
  { title: "DtMF", artist: "Bad Bunny" },
  { title: "DESPECHA", artist: "Rosalia" },
  { title: "Dreams", artist: "Fleetwood Mac" },
  { title: "Weird Fishes/ Arpeggi", artist: "Radiohead" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana" },
  { title: "Like a Prayer - Live", artist: "Madonna" },
  { title: "lofi hip hop radio beats to relax study to", artist: "" }
];

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  })
);
const limit = Number(args.get("limit") || fixtures.length) || fixtures.length;
const selectedFixtures = fixtures.slice(0, Math.max(1, Math.min(limit, fixtures.length)));

const providers = [
  ["spotify_web", probeSpotifyWeb],
  ["rapidapi_spotify23", probeRapidApiSpotify],
  ["rapidapi_spotify_web_api3", probeRapidApiSpotifyWebApi3],
  ["itunes", probeItunes],
  ["rapidapi_shazam", probeRapidApiShazam],
  ["deezer_api", probeDeezerApi],
  ["songlink", probeSonglink],
  ["idhs", probeIdhs],
  ["rapidapi_musicdata_youtube_video", probeRapidApiMusicDataYoutubeVideo],
  ["youtube_api", probeYoutubeApi],
  ["rapidapi_youtube_music_api3", probeRapidApiYoutubeMusic]
];

const rows = [];
for (const fixture of selectedFixtures) {
  const query = [fixture.artist, fixture.title].filter(Boolean).join(" ");
  for (const [provider, fn] of providers) {
    const startedAt = performance.now();
    const result = await fn(fixture, query).catch(error => ({
      hit: false,
      url: "",
      error: error?.message || String(error)
    }));
    rows.push({
      provider,
      query,
      hit: Boolean(result?.hit),
      latencyMs: Math.round(performance.now() - startedAt),
      url: result?.url || "",
      error: result?.error || ""
    });
  }
}

const summary = providers.map(([provider]) => {
  const providerRows = rows.filter(row => row.provider === provider);
  const hits = providerRows.filter(row => row.hit).length;
  const avgLatencyMs = Math.round(
    providerRows.reduce((sum, row) => sum + row.latencyMs, 0) / Math.max(1, providerRows.length)
  );
  return {
    provider,
    hits,
    total: providerRows.length,
    hitRate: `${Math.round((hits / Math.max(1, providerRows.length)) * 100)}%`,
    avgLatencyMs
  };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2));

async function probeSpotifyWeb(_fixture, query) {
  const match = await searchSpotifyWebTrack(query, _fixture);
  return {
    hit: Boolean(match?.url),
    url: match?.url || ""
  };
}

async function probeRapidApiSpotify(fixture, query) {
  if (!isRapidApiSpotifyEnabled()) return { hit: false, url: "", error: "rapidapi_spotify_disabled_or_missing_key" };
  const match = await searchRapidApiSpotifyTrack({
    query,
    title: fixture.title,
    artist: fixture.artist
  });
  return {
    hit: Boolean(match?.url),
    url: match?.url || "",
    error: match?.url ? "" : "no_match"
  };
}

async function probeRapidApiSpotifyWebApi3(fixture, query) {
  if (!isRapidApiSpotifyWebApi3Enabled()) return { hit: false, url: "", error: "rapidapi_spotify_web_api3_disabled_or_missing_key" };
  const match = await searchRapidApiSpotifyWebApi3Track({
    query,
    title: fixture.title,
    artist: fixture.artist
  });
  return {
    hit: Boolean(match?.url),
    url: match?.url || "",
    error: match?.url ? "" : "no_match"
  };
}

async function probeItunes(fixture, query) {
  const url = new URL(ITUNES_SEARCH_API_URL);
  url.searchParams.set("term", query);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "1");
  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) return { hit: false, url: "", error: `itunes_${response.status}` };
  const payload = await response.json();
  const song = (Array.isArray(payload?.results) ? payload.results : []).find(item => item?.trackViewUrl);
  return {
    hit: Boolean(song?.trackViewUrl),
    url: song?.trackViewUrl || "",
    expected: [fixture.artist, fixture.title].filter(Boolean).join(" - ")
  };
}

async function probeRapidApiShazam(fixture, query) {
  if (!isRapidApiShazamEnabled()) return { hit: false, url: "", error: "rapidapi_shazam_disabled_or_missing_key" };
  const match = await searchRapidApiShazamTrack({
    query,
    title: fixture.title,
    artist: fixture.artist
  });
  return {
    hit: Boolean(match?.appleMusicUrl),
    url: match?.appleMusicUrl || "",
    error: match?.appleMusicUrl ? "" : "no_match"
  };
}

async function probeDeezerApi(fixture, query) {
  const match = await findBestDeezerTrack({
    query,
    title: fixture.title,
    artist: fixture.artist
  });
  return {
    hit: Boolean(match?.url),
    url: match?.url || "",
    error: match?.url ? "" : "no_match"
  };
}

async function probeSonglink(fixture) {
  if (!fixture.inputUrl) return { hit: false, url: "", error: "missing_input_url" };
  const url = new URL(SONGLINK_API_URL);
  url.searchParams.set("url", fixture.inputUrl);
  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) return { hit: false, url: "", error: `songlink_${response.status}` };
  const payload = await response.json();
  const links = Object.values(payload?.linksByPlatform || {}).map(item => item?.url).filter(Boolean);
  return { hit: links.length > 0, url: links[0] || "" };
}

async function probeIdhs(fixture) {
  if (!fixture.inputUrl) return { hit: false, url: "", error: "missing_input_url" };
  const response = await fetchWithTimeout(IDHS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      link: fixture.inputUrl,
      adapters: ["appleMusic", "spotify", "youTube"]
    })
  });
  if (!response.ok) return { hit: false, url: "", error: `idhs_${response.status}` };
  const payload = await response.json();
  const links = Array.isArray(payload?.links) ? payload.links.map(item => item?.url).filter(Boolean) : [];
  return { hit: links.length > 0, url: links[0] || "" };
}

async function probeRapidApiMusicDataYoutubeVideo(fixture) {
  if (!isRapidApiMusicDataEnabled()) return { hit: false, url: "", error: "rapidapi_musicdata_disabled_or_missing_key" };
  const videoId = getYoutubeVideoId(fixture.inputUrl || "");
  if (!videoId) return { hit: false, url: "", error: "missing_video_id" };
  const metadata = await fetchRapidApiMusicDataYoutubeVideo(videoId);
  return {
    hit: Boolean(metadata?.title || metadata?.artist),
    url: metadata?.url || "",
    error: metadata?.title || metadata?.artist ? "" : "no_metadata"
  };
}

async function probeYoutubeApi(_fixture, query) {
  if (!process.env.YOUTUBE_API_KEY) return { hit: false, url: "", error: "missing_youtube_api_key" };
  const match = await searchYoutubeVideoForTrack(query, _fixture);
  return {
    hit: Boolean(match?.url),
    url: match?.url || "",
    error: match?.url ? "" : "no_match"
  };
}

async function probeRapidApiYoutubeMusic(fixture, query) {
  if (!isRapidApiYoutubeMusicEnabled()) return { hit: false, url: "", error: "rapidapi_youtube_music_disabled_or_missing_key" };
  const match = await searchRapidApiYoutubeMusicTrack({
    query,
    title: fixture.title,
    artist: fixture.artist
  });
  return {
    hit: Boolean(match?.url),
    url: match?.url || "",
    error: match?.url ? "" : "no_match"
  };
}

function getYoutubeVideoId(value) {
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
