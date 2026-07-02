import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  buildCanonicalTrackKey,
  buildTrackId,
  AUTOMATIC_PLATFORM_KEYS,
  canonicalizeMediaUrl,
  decorateResultForResponse,
  filterDisplayLinks
} from "./music-contract.js";

let sqlClient = null;
let injectedSqlClient = null;
let schemaReady = null;
let providerAttemptsLastPrunedAt = 0;

const DAY_MS = 24 * 60 * 60 * 1000;
const PROVIDER_ATTEMPT_PRUNE_INTERVAL_MS = DAY_MS;
const DEFAULT_PROVIDER_ATTEMPT_RETENTION_DAYS = 30;
const DEFAULT_PROVIDER_ATTEMPT_MAX_ROWS = 10_000;

function getSql() {
  if (injectedSqlClient) return injectedSqlClient;
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) return null;
  if (!sqlClient) {
    sqlClient = databaseUrl.startsWith("pglite://")
      ? createPgliteSqlClient(databaseUrl)
      : neon(databaseUrl);
  }
  return sqlClient;
}

export function isMusicLibraryEnabled() {
  return Boolean(getSql());
}

export function __setMusicLibrarySqlClientForTests(sql) {
  injectedSqlClient = sql;
  schemaReady = null;
}

export async function __resetMusicLibraryForTests() {
  if (typeof sqlClient?.close === "function") {
    await sqlClient.close();
  }
  injectedSqlClient = null;
  sqlClient = null;
  schemaReady = null;
  providerAttemptsLastPrunedAt = 0;
}

export async function readCachedResultByAlias(alias) {
  const sql = getSql();
  const normalizedAlias = canonicalizeMediaUrl(alias);
  if (!sql || !normalizedAlias) return null;

  try {
    await ensureSchema();
    const rows = await sql`
      select track_id
      from track_aliases
      where alias = ${normalizedAlias}
      limit 1
    `;
    if (!rows.length) return null;
    return readCachedResultByTrackId(rows[0].track_id, { cacheStatus: "hit" });
  } catch (error) {
    logLibraryWarning("read_alias", error);
    return null;
  }
}

export async function readCachedResultByTrackKey(canonicalKey) {
  const sql = getSql();
  const key = String(canonicalKey || "").trim();
  if (!sql || !key) return null;

  try {
    await ensureSchema();
    const rows = await sql`
      select id
      from tracks
      where canonical_key = ${key}
      limit 1
    `;
    if (!rows.length) return null;
    return readCachedResultByTrackId(rows[0].id, { cacheStatus: "hit" });
  } catch (error) {
    logLibraryWarning("read_track_key", error);
    return null;
  }
}

export async function readCachedTrackById(trackId) {
  const sql = getSql();
  const id = String(trackId || "").trim();
  if (!sql || !id) return null;

  try {
    await ensureSchema();
    const rows = await sql`
      select id, canonical_key, title, artist, album, image, duration_ms, release_year, record_type
      from tracks
      where id = ${id}
      limit 1
    `;
    return rows[0] || null;
  } catch (error) {
    logLibraryWarning("read_track_id", error);
    return null;
  }
}

export async function readCachedResultByTrackId(trackId, { cacheStatus = "hit" } = {}) {
  const sql = getSql();
  const id = String(trackId || "").trim();
  if (!sql || !id) return null;

  try {
    await ensureSchema();
    const tracks = await sql`
      select id, canonical_key, title, artist, album, image, duration_ms, release_year, record_type
      from tracks
      where id = ${id}
      limit 1
    `;
    if (!tracks.length) return null;

    const links = await sql`
      select platform as type, url, is_verified as "isVerified", source
      from track_links
      where track_id = ${id}
        and status = 'published'
      order by updated_at desc
    `;

    const track = tracks[0];
    const result = decorateResultForResponse(
      {
        title: track.title,
        description: track.artist,
        album: track.album,
        image: track.image,
        durationMs: Number(track.duration_ms || 0) || 0,
        releaseYear: track.release_year,
        recordType: track.record_type,
        links: links.map(item => ({ ...item, source: "cache" }))
      },
      { cacheStatus, trackId: track.id }
    );

    return result.links.length ? result : null;
  } catch (error) {
    logLibraryWarning("read_track_result", error);
    return null;
  }
}

export async function attachAliasesToTrack(trackId, aliases = []) {
  const sql = getSql();
  const id = String(trackId || "").trim();
  if (!sql || !id || !Array.isArray(aliases) || !aliases.length) return;

  try {
    await ensureSchema();
    for (const alias of aliases.map(canonicalizeMediaUrl).filter(Boolean)) {
      await sql`
        insert into track_aliases (alias, track_id, source)
        values (${alias}, ${id}, 'input')
        on conflict (alias) do update set
          track_id = excluded.track_id,
          source = excluded.source
      `;
    }
  } catch (error) {
    logLibraryWarning("attach_aliases", error);
  }
}

export async function upsertCachedResult(result, { aliases = [], defaultSource = "provider" } = {}) {
  const sql = getSql();
  if (!sql) return null;

  const links = filterDisplayLinks(result?.links || []);
  if (!links.length) return null;

  const canonicalKey = buildCanonicalTrackKey(result);
  if (!canonicalKey) return null;

  const trackId = result?.trackId || buildTrackId(canonicalKey);
  const title = String(result?.title || "música encontrada").trim() || "música encontrada";
  const artist = String(result?.description || result?.artist || "").trim();
  const album = String(result?.album || "").trim();
  const image = String(result?.image || "").trim();
  const durationMs = normalizeDurationMs(result?.durationMs || result?.duration || 0);
  const releaseYear = normalizeReleaseYear(result?.releaseYear || result?.year || result?.releaseDate || result?.release_date || album);
  const recordType = normalizeRecordType(result?.recordType || "");

  try {
    await ensureSchema();
    await sql`
      insert into tracks (id, canonical_key, title, artist, album, image, duration_ms, release_year, record_type, source)
      values (${trackId}, ${canonicalKey}, ${title}, ${artist}, ${album}, ${image}, ${durationMs}, ${releaseYear}, ${recordType}, ${defaultSource})
      on conflict (id) do update set
        canonical_key = excluded.canonical_key,
        title = coalesce(nullif(excluded.title, ''), tracks.title),
        artist = coalesce(nullif(excluded.artist, ''), tracks.artist),
        album = coalesce(nullif(excluded.album, ''), tracks.album),
        image = coalesce(nullif(excluded.image, ''), tracks.image),
        duration_ms = greatest(tracks.duration_ms, excluded.duration_ms),
        release_year = coalesce(nullif(excluded.release_year, ''), tracks.release_year),
        record_type = coalesce(nullif(excluded.record_type, ''), tracks.record_type),
        updated_at = now()
    `;

    for (const link of links) {
      await sql`
        insert into track_links (track_id, platform, url, source, is_verified, status, confidence)
        values (${trackId}, ${link.type}, ${link.url}, ${link.source || defaultSource}, ${Boolean(link.isVerified)}, 'published', 100)
        on conflict (track_id, platform) where status = 'published'
        do update set
          url = excluded.url,
          source = excluded.source,
          is_verified = track_links.is_verified or excluded.is_verified,
          confidence = greatest(track_links.confidence, excluded.confidence),
          updated_at = now()
      `;
      await deletePendingLinksForPlatform(sql, trackId, link.type);
    }

    await attachAliasesToTrack(trackId, aliases);
    return { trackId, canonicalKey };
  } catch (error) {
    logLibraryWarning("upsert_result", error);
    return null;
  }
}

export async function upsertManualLink({ trackId, platform, url, isVerified = false, status = "pending", confidence = 0 }) {
  const sql = getSql();
  const id = String(trackId || "").trim();
  if (!sql || !id || !platform || !url) return null;

  try {
    await ensureSchema();
    if (status === "published") {
      await sql`
        insert into track_links (track_id, platform, url, source, is_verified, status, confidence)
        values (${id}, ${platform}, ${url}, 'manual', ${Boolean(isVerified)}, 'published', ${Number(confidence) || 0})
        on conflict (track_id, platform) where status = 'published'
        do update set
          url = excluded.url,
          source = 'manual',
          is_verified = excluded.is_verified,
          confidence = excluded.confidence,
          updated_at = now()
      `;
      await deletePendingLinksForPlatform(sql, id, platform);
    } else {
      await sql`
        insert into track_links (track_id, platform, url, source, is_verified, status, confidence)
        values (${id}, ${platform}, ${url}, 'manual', ${Boolean(isVerified)}, ${status}, ${Number(confidence) || 0})
      `;
    }

    return readCachedResultByTrackId(id, { cacheStatus: "hit" });
  } catch (error) {
    logLibraryWarning("upsert_manual_link", error);
    return null;
  }
}

async function deletePendingLinksForPlatform(sql, trackId, platform) {
  await sql`
    delete from track_links
    where track_id = ${trackId}
      and platform = ${platform}
      and status = 'pending'
  `;
}

export async function recordProviderAttempt({ trackKey = "", provider, status, latencyMs = 0, message = "" }) {
  const sql = getSql();
  if (!sql || !provider || !status) return;

  try {
    await ensureSchema();
    await sql`
      insert into provider_attempts (track_key, provider, status, latency_ms, message)
      values (${String(trackKey || "")}, ${provider}, ${status}, ${Number(latencyMs) || 0}, ${String(message || "").slice(0, 500)})
    `;
  } catch (error) {
    logLibraryWarning("record_provider_attempt", error);
    return;
  }

  try {
    await pruneProviderAttemptsIfDue(sql);
  } catch (error) {
    logLibraryWarning("prune_provider_attempts", error);
  }
}

export async function readMusicLibraryStats({ days = 14, recentLimit = 50 } = {}) {
  const sql = getSql();
  if (!sql) return null;

  const windowDays = clampInteger(days, 1, 90, 14);
  const limit = clampInteger(recentLimit, 1, 200, 50);
  const now = Date.now();
  const sinceIso = new Date(now - windowDays * DAY_MS).toISOString();

  try {
    await ensureSchema();
    const [totals = {}] = await sql`
      select
        (select count(*)::int from tracks) as tracks,
        (select count(*)::int from track_links where status = 'published') as published_links,
        (select count(*)::int from track_links where status = 'pending') as pending_links,
        (select count(*)::int from track_aliases) as aliases,
        (select count(*)::int from provider_attempts) as provider_attempts
    `;
    const tracks = await sql`
      select id, title, artist, created_at
      from tracks
    `;
    const links = await sql`
      select track_id, platform, source, status, is_verified, url, created_at, updated_at
      from track_links
    `;
    const aliasesInWindow = await sql`
      select a.alias, a.track_id, a.source, a.created_at, t.title, t.artist
      from track_aliases a
      left join tracks t on t.id = a.track_id
      where a.created_at >= ${sinceIso}::timestamptz
      order by a.created_at desc
    `;
    const linksInWindow = await sql`
      select l.track_id, l.platform, l.source, l.status, l.is_verified, l.url, l.created_at, l.updated_at, t.title, t.artist
      from track_links l
      left join tracks t on t.id = l.track_id
      where l.updated_at >= ${sinceIso}::timestamptz
      order by l.updated_at desc, l.id desc
    `;
    const attemptsInWindow = await sql`
      select provider, status, latency_ms, message, track_key, created_at
      from provider_attempts
      where created_at >= ${sinceIso}::timestamptz
      order by created_at desc
    `;
    const recentProviderIssues = await sql`
      select provider, status, latency_ms, message, track_key, created_at
      from provider_attempts
      where status <> 'hit'
      order by created_at desc
      limit ${limit}
    `;

    const storage = await readMusicLibraryStorageStats(sql);

    return buildMusicLibraryStats({
      generatedAt: new Date(now).toISOString(),
      sinceIso,
      windowDays,
      limit,
      totals,
      tracks,
      links,
      aliasesInWindow,
      linksInWindow,
      attemptsInWindow,
      recentProviderIssues,
      storage,
      now
    });
  } catch (error) {
    logLibraryWarning("read_library_stats", error);
    throw error;
  }
}

async function pruneProviderAttemptsIfDue(sql) {
  const now = Date.now();
  if (providerAttemptsLastPrunedAt && now - providerAttemptsLastPrunedAt < PROVIDER_ATTEMPT_PRUNE_INTERVAL_MS) {
    return;
  }
  providerAttemptsLastPrunedAt = now;

  const retentionDays = getPositiveIntegerEnv("PROVIDER_ATTEMPT_RETENTION_DAYS", DEFAULT_PROVIDER_ATTEMPT_RETENTION_DAYS);
  const maxRows = getPositiveIntegerEnv("PROVIDER_ATTEMPT_MAX_ROWS", DEFAULT_PROVIDER_ATTEMPT_MAX_ROWS);
  const cutoffIso = new Date(now - retentionDays * DAY_MS).toISOString();

  await sql`
    delete from provider_attempts
    where created_at < ${cutoffIso}::timestamptz
  `;

  await sql`
    delete from provider_attempts
    where id not in (
      select id
      from provider_attempts
      order by created_at desc, id desc
      limit ${maxRows}
    )
  `;
}

async function ensureSchema() {
  const sql = getSql();
  if (!sql) return;
  if (!schemaReady) {
    schemaReady = createSchema(sql).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function createSchema(sql) {
  await sql`
    create table if not exists tracks (
      id text primary key,
      canonical_key text not null unique,
      title text not null,
      artist text default '',
      album text default '',
      image text default '',
      duration_ms integer not null default 0,
      release_year text default '',
      record_type text default '',
      source text default 'provider',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await ensureTrackPreviewColumns(sql);

  await sql`
    create table if not exists track_links (
      id bigserial primary key,
      track_id text not null references tracks(id) on delete cascade,
      platform text not null,
      url text not null,
      source text not null default 'provider',
      is_verified boolean not null default false,
      status text not null default 'published',
      confidence integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create unique index if not exists track_links_published_unique
    on track_links (track_id, platform)
    where status = 'published'
  `;

  await sql`
    create index if not exists track_links_updated_at_idx
    on track_links (updated_at)
  `;

  await sql`
    create table if not exists track_aliases (
      alias text primary key,
      track_id text not null references tracks(id) on delete cascade,
      source text not null default 'input',
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists track_aliases_created_at_idx
    on track_aliases (created_at)
  `;

  await sql`
    create table if not exists provider_attempts (
      id bigserial primary key,
      track_key text default '',
      provider text not null,
      status text not null,
      latency_ms integer not null default 0,
      message text default '',
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists provider_attempts_created_at_idx
    on provider_attempts (created_at)
  `;
}

async function ensureTrackPreviewColumns(sql) {
  await sql`alter table tracks add column if not exists duration_ms integer not null default 0`;
  await sql`alter table tracks add column if not exists release_year text default ''`;
  await sql`alter table tracks add column if not exists record_type text default ''`;
}

function getPositiveIntegerEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDurationMs(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number < 10_000 ? number * 1000 : number);
}

function normalizeReleaseYear(value) {
  const match = String(value || "").match(/\b(19\d{2}|20\d{2})\b/);
  return match ? match[1] : "";
}

function normalizeRecordType(value) {
  const text = String(value || "").trim();
  return text.length > 40 ? text.slice(0, 40) : text;
}

async function readMusicLibraryStorageStats(sql) {
  try {
    const rows = await sql`
      select 'tracks' as table_name, pg_total_relation_size('tracks')::bigint as bytes
      union all
      select 'track_links' as table_name, pg_total_relation_size('track_links')::bigint as bytes
      union all
      select 'track_aliases' as table_name, pg_total_relation_size('track_aliases')::bigint as bytes
      union all
      select 'provider_attempts' as table_name, pg_total_relation_size('provider_attempts')::bigint as bytes
    `;
    const tables = rows.map(row => ({
      table: String(row.table_name || ""),
      bytes: toNumber(row.bytes)
    }));
    return {
      available: true,
      totalBytes: tables.reduce((sum, item) => sum + item.bytes, 0),
      tables
    };
  } catch (_error) {
    return {
      available: false,
      totalBytes: null,
      tables: []
    };
  }
}

function buildMusicLibraryStats({
  generatedAt,
  sinceIso,
  windowDays,
  limit,
  totals,
  tracks,
  links,
  aliasesInWindow,
  linksInWindow,
  attemptsInWindow,
  recentProviderIssues,
  storage,
  now
}) {
  const publishedLinks = links.filter(link => String(link.status || "") === "published");
  const linksByTrack = new Map();
  const linkCountByPlatform = new Map();
  const linkCountBySource = new Map();
  const dayMap = new Map();

  for (const track of tracks) {
    const day = toDayKey(track.created_at);
    if (day && new Date(track.created_at).getTime() >= new Date(sinceIso).getTime()) {
      getDayStats(dayMap, day).tracksCreated += 1;
    }
  }

  for (const link of publishedLinks) {
    const platform = String(link.platform || "");
    const source = String(link.source || "unknown");
    const trackId = String(link.track_id || "");
    if (!linksByTrack.has(trackId)) linksByTrack.set(trackId, new Set());
    linksByTrack.get(trackId).add(platform);
    incrementMap(linkCountByPlatform, platform);
    incrementMap(linkCountBySource, source);
  }

  for (const alias of aliasesInWindow) {
    const day = toDayKey(alias.created_at);
    if (day) getDayStats(dayMap, day).inputsTracked += 1;
  }

  for (const link of linksInWindow) {
    const day = toDayKey(link.updated_at);
    if (!day) continue;
    const stats = getDayStats(dayMap, day);
    stats.linksUpdated += 1;
    incrementNested(stats.linkSources, String(link.source || "unknown"));
    incrementNested(stats.platforms, String(link.platform || "unknown"));
  }

  for (const attempt of attemptsInWindow) {
    const day = toDayKey(attempt.created_at);
    if (!day) continue;
    const stats = getDayStats(dayMap, day);
    const status = String(attempt.status || "unknown");
    stats.providerAttempts += 1;
    if (status === "hit") stats.providerHits += 1;
    else if (status === "miss") stats.providerMisses += 1;
    else stats.providerErrors += 1;
    incrementProviderBucket(stats.providers, attempt);
  }

  const completeTracks = tracks.filter(track => {
    const trackPlatforms = linksByTrack.get(String(track.id || ""));
    return AUTOMATIC_PLATFORM_KEYS.every(platform => trackPlatforms?.has(platform));
  }).length;
  const platformCompleteness = AUTOMATIC_PLATFORM_KEYS.map(platform => {
    const tracksWithLink = tracks.filter(track => linksByTrack.get(String(track.id || ""))?.has(platform)).length;
    return {
      platform,
      publishedLinks: toNumber(linkCountByPlatform.get(platform)),
      tracksWithLink,
      missingTracks: Math.max(0, tracks.length - tracksWithLink)
    };
  });

  return {
    generatedAt,
    window: {
      days: windowDays,
      since: sinceIso,
      recentLimit: limit
    },
    totals: {
      tracks: toNumber(totals.tracks),
      publishedLinks: toNumber(totals.published_links),
      pendingLinks: toNumber(totals.pending_links),
      aliases: toNumber(totals.aliases),
      providerAttempts: toNumber(totals.provider_attempts)
    },
    storage,
    platforms: {
      automatic: AUTOMATIC_PLATFORM_KEYS,
      completeTracks,
      partialTracks: Math.max(0, tracks.length - completeTracks),
      byPlatform: platformCompleteness
    },
    sources: mapToCountRows(linkCountBySource, "source"),
    providerHealth: {
      last24h: buildProviderWindow(attemptsInWindow, now - DAY_MS),
      last7d: buildProviderWindow(attemptsInWindow, now - 7 * DAY_MS)
    },
    daily: Array.from(dayMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(finalizeDayStats),
    recent: {
      trackedInputs: aliasesInWindow.slice(0, limit).map(formatTrackedInput),
      publishedLinks: linksInWindow.slice(0, limit).map(formatTrackedLink),
      providerIssues: recentProviderIssues.map(formatProviderIssue)
    }
  };
}

function getDayStats(dayMap, date) {
  if (!dayMap.has(date)) {
    dayMap.set(date, {
      date,
      tracksCreated: 0,
      inputsTracked: 0,
      linksUpdated: 0,
      providerAttempts: 0,
      providerHits: 0,
      providerMisses: 0,
      providerErrors: 0,
      linkSources: new Map(),
      platforms: new Map(),
      providers: new Map()
    });
  }
  return dayMap.get(date);
}

function finalizeDayStats(stats) {
  return {
    ...stats,
    linkSources: mapToCountRows(stats.linkSources, "source"),
    platforms: mapToCountRows(stats.platforms, "platform"),
    providers: finalizeProviderBuckets(stats.providers)
  };
}

function buildProviderWindow(attempts, cutoffMs) {
  const buckets = new Map();
  for (const attempt of attempts) {
    if (new Date(attempt.created_at).getTime() < cutoffMs) continue;
    incrementProviderBucket(buckets, attempt);
  }
  return finalizeProviderBuckets(buckets);
}

function incrementProviderBucket(buckets, attempt) {
  const provider = String(attempt.provider || "unknown");
  const status = String(attempt.status || "unknown");
  if (!buckets.has(provider)) {
    buckets.set(provider, {
      provider,
      total: 0,
      hit: 0,
      miss: 0,
      error: 0,
      latencyTotalMs: 0,
      latencyCount: 0
    });
  }
  const bucket = buckets.get(provider);
  bucket.total += 1;
  if (status === "hit") bucket.hit += 1;
  else if (status === "miss") bucket.miss += 1;
  else bucket.error += 1;
  const latencyMs = toNumber(attempt.latency_ms);
  if (latencyMs >= 0) {
    bucket.latencyTotalMs += latencyMs;
    bucket.latencyCount += 1;
  }
}

function finalizeProviderBuckets(buckets) {
  return Array.from(buckets.values())
    .map(bucket => ({
      provider: bucket.provider,
      total: bucket.total,
      hit: bucket.hit,
      miss: bucket.miss,
      error: bucket.error,
      avgLatencyMs: bucket.latencyCount
        ? Math.round(bucket.latencyTotalMs / bucket.latencyCount)
        : 0
    }))
    .sort((a, b) => b.total - a.total || a.provider.localeCompare(b.provider));
}

function formatTrackedInput(row) {
  return {
    createdAt: toIso(row.created_at),
    alias: String(row.alias || ""),
    source: String(row.source || ""),
    trackId: String(row.track_id || ""),
    title: String(row.title || ""),
    artist: String(row.artist || "")
  };
}

function formatTrackedLink(row) {
  return {
    updatedAt: toIso(row.updated_at),
    createdAt: toIso(row.created_at),
    platform: String(row.platform || ""),
    source: String(row.source || ""),
    status: String(row.status || ""),
    isVerified: Boolean(row.is_verified),
    url: String(row.url || ""),
    trackId: String(row.track_id || ""),
    title: String(row.title || ""),
    artist: String(row.artist || "")
  };
}

function formatProviderIssue(row) {
  return {
    createdAt: toIso(row.created_at),
    provider: String(row.provider || ""),
    status: String(row.status || ""),
    trackKey: String(row.track_key || ""),
    latencyMs: toNumber(row.latency_ms),
    message: String(row.message || "")
  };
}

function mapToCountRows(map, keyName) {
  return Array.from(map.entries())
    .map(([key, count]) => ({
      [keyName]: key,
      count: toNumber(count)
    }))
    .sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])));
}

function incrementMap(map, key, amount = 1) {
  map.set(key, toNumber(map.get(key)) + amount);
}

function incrementNested(map, key, amount = 1) {
  incrementMap(map, key || "unknown", amount);
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function toNumber(value) {
  if (typeof value === "bigint") return Number(value);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toIso(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toISOString();
}

function toDayKey(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : "";
}

function logLibraryWarning(action, error) {
  console.warn(
    JSON.stringify({
      scope: "api.music_library",
      action,
      message: String(error?.message || error || "unknown_error")
    })
  );
}

function createPgliteSqlClient(databaseUrl) {
  const db = new PGlite(resolvePgliteDataDir(databaseUrl));
  const sql = async (strings, ...values) => {
    const query = strings.reduce((acc, part, index) => {
      const value = index < values.length ? toSqlLiteral(values[index]) : "";
      return `${acc}${part}${value}`;
    }, "");
    const result = await db.query(query);
    return result.rows;
  };
  sql.close = () => db.close();
  return sql;
}

function resolvePgliteDataDir(databaseUrl) {
  const value = String(databaseUrl || "").replace(/^pglite:\/\//, "").trim();
  if (!value || value === "memory") return "memory://music-link-swapper";
  const dataDir = resolve(value);
  mkdirSync(dirname(dataDir), { recursive: true });
  return dataDir;
}

function toSqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
}
