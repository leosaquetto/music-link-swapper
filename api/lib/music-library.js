import { neon } from "@neondatabase/serverless";

import {
  buildCanonicalTrackKey,
  buildTrackId,
  canonicalizeMediaUrl,
  decorateResultForResponse,
  filterDisplayLinks
} from "./music-contract.js";

let sqlClient = null;
let injectedSqlClient = null;
let schemaReady = null;

function getSql() {
  if (injectedSqlClient) return injectedSqlClient;
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function isMusicLibraryEnabled() {
  return Boolean(getSql());
}

export function __setMusicLibrarySqlClientForTests(sql) {
  injectedSqlClient = sql;
  schemaReady = null;
}

export function __resetMusicLibraryForTests() {
  injectedSqlClient = null;
  sqlClient = null;
  schemaReady = null;
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
      select id, canonical_key, title, artist, album, image
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
      select id, canonical_key, title, artist, album, image
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

  try {
    await ensureSchema();
    await sql`
      insert into tracks (id, canonical_key, title, artist, album, image, source)
      values (${trackId}, ${canonicalKey}, ${title}, ${artist}, ${album}, ${image}, ${defaultSource})
      on conflict (id) do update set
        canonical_key = excluded.canonical_key,
        title = coalesce(nullif(excluded.title, ''), tracks.title),
        artist = coalesce(nullif(excluded.artist, ''), tracks.artist),
        album = coalesce(nullif(excluded.album, ''), tracks.album),
        image = coalesce(nullif(excluded.image, ''), tracks.image),
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
  }
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
      source text default 'provider',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

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
    create table if not exists track_aliases (
      alias text primary key,
      track_id text not null references tracks(id) on delete cascade,
      source text not null default 'input',
      created_at timestamptz not null default now()
    )
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
