import test from "node:test";
import assert from "node:assert/strict";

import { newDb } from "pg-mem";

import {
  __resetMusicLibraryForTests,
  __setMusicLibrarySqlClientForTests,
  attachAliasesToTrack,
  isMusicLibraryEnabled,
  readCachedResultByAlias,
  readCachedResultByTrackId,
  upsertCachedResult,
  upsertManualLink
} from "../api/lib/music-library.js";

test("music library schema supports cached links, aliases, idempotent upserts, and manual corrections", async () => {
  const db = newDb();
  registerPgFunctions(db);
  const sql = createPgMemSqlTag(db);
  __setMusicLibrarySqlClientForTests(sql);

  try {
    const initial = {
      title: "One More Time",
      description: "Daft Punk",
      album: "Discovery",
      links: [
        {
          type: "spotify",
          url: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV?si=abc",
          isVerified: true,
          source: "spotify_web"
        },
        {
          type: "spotify",
          url: "https://open.spotify.com/search/daft%20punk",
          isVerified: false,
          source: "generated"
        },
        {
          type: "appleMusic",
          url: "https://music.apple.com/us/album/one-more-time/697194953?i=697195462",
          isVerified: true,
          source: "itunes"
        },
        {
          type: "deezer",
          url: "https://www.deezer.com/track/3135556",
          isVerified: true,
          source: "idhs"
        }
      ]
    };

    const first = await upsertCachedResult(initial, {
      aliases: ["https://music.apple.com/us/album/one-more-time/697194953?i=697195462&l=en-US"],
      defaultSource: "test"
    });
    assert.match(first.trackId, /^trk_[a-f0-9]{20}$/);

    const second = await upsertCachedResult(initial, {
      aliases: ["https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV?si=second"],
      defaultSource: "test"
    });
    assert.equal(second.trackId, first.trackId);

    const cachedByAlias = await readCachedResultByAlias("https://music.apple.com/us/album/one-more-time/697194953?i=697195462");
    assert.equal(cachedByAlias.title, "One More Time");
    assert.deepEqual(
      cachedByAlias.links.map(link => link.type),
      ["spotify", "appleMusic", "deezer"]
    );
    assert.equal(cachedByAlias.links.some(link => link.url.includes("/search")), false);

    await attachAliasesToTrack(first.trackId, ["https://example.com/custom-alias"]);
    const cachedByCustomAlias = await readCachedResultByAlias("https://example.com/custom-alias");
    assert.equal(cachedByCustomAlias.trackId, first.trackId);

    const afterManual = await upsertManualLink({
      trackId: first.trackId,
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isVerified: true,
      status: "published",
      confidence: 95
    });
    assert.deepEqual(
      afterManual.links.map(link => link.type),
      ["spotify", "appleMusic", "deezer", "youtube", "youtubeMusic"]
    );

    const rows = sql.raw("select platform, count(*)::int as count from track_links where status = 'published' group by platform order by platform");
    assert.deepEqual(rows, [
      { platform: "appleMusic", count: 1 },
      { platform: "deezer", count: 1 },
      { platform: "spotify", count: 1 },
      { platform: "youtube", count: 1 }
    ]);

    const cachedById = await readCachedResultByTrackId(first.trackId);
    assert.deepEqual(cachedById.missingPlatforms, []);
  } finally {
    await __resetMusicLibraryForTests();
  }
});

test("music library supports zero-cost pglite DATABASE_URL", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "pglite://memory";
  await __resetMusicLibraryForTests();

  try {
    assert.equal(isMusicLibraryEnabled(), true);

    const persisted = await upsertCachedResult(
      {
        title: "Saturn",
        description: "SZA",
        links: [
          {
            type: "spotify",
            url: "https://open.spotify.com/track/1bjeWoagtHmUKputLVyDxQ",
            isVerified: true,
            source: "spotify_web"
          }
        ]
      },
      {
        aliases: ["https://open.spotify.com/track/1bjeWoagtHmUKputLVyDxQ?si=abc"],
        defaultSource: "pglite_test"
      }
    );

    assert.match(persisted.trackId, /^trk_[a-f0-9]{20}$/);
    const cached = await readCachedResultByAlias("https://open.spotify.com/track/1bjeWoagtHmUKputLVyDxQ");
    assert.equal(cached.title, "Saturn");
    assert.deepEqual(cached.links.map(link => link.type), ["spotify"]);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await __resetMusicLibraryForTests();
  }
});

function registerPgFunctions(db) {
  db.public.registerFunction({
    name: "nullif",
    args: ["text", "text"],
    returns: "text",
    implementation: (left, right) => (left === right ? null : left)
  });
}

function createPgMemSqlTag(db) {
  const tag = (strings, ...values) => {
    const sql = normalizePgMemSql(strings.reduce((acc, part, index) => {
      const value = index < values.length ? toSqlLiteral(values[index]) : "";
      return `${acc}${part}${value}`;
    }, ""));
    return db.public.many(sql);
  };
  tag.raw = sql => db.public.many(sql);
  return tag;
}

function normalizePgMemSql(sql) {
  return sql
    .replace(
      /create unique index if not exists track_links_published_unique\s+on track_links \(track_id, platform\)\s+where status = 'published'/i,
      "create unique index if not exists track_links_published_unique on track_links (track_id, platform)"
    )
    .replace(
      /on conflict \(track_id, platform\) where status = 'published'/gi,
      "on conflict (track_id, platform)"
    );
}

function toSqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
}
