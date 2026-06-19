import test from "node:test";
import assert from "node:assert/strict";

import { newDb } from "pg-mem";

import trackHandler from "../api/track.js";
import {
  __resetMusicLibraryForTests,
  __setMusicLibrarySqlClientForTests,
  upsertCachedResult,
  upsertManualLink
} from "../api/lib/music-library.js";

test("GET /api/track returns a cached public card by trackId", async () => {
  const { trackId } = await seedPublicTrack();

  try {
    const response = await callTrackApi({ method: "GET", query: { trackId } });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.trackId, trackId);
    assert.equal(response.body.data.title, "One More Time");
    assert.deepEqual(
      response.body.data.links.map(link => link.type),
      ["spotify", "appleMusic", "deezer", "tidal"]
    );
  } finally {
    await __resetMusicLibraryForTests();
  }
});

test("GET /api/track rejects missing and invalid track ids", async () => {
  const missing = await callTrackApi({ method: "GET", query: {} });
  const invalid = await callTrackApi({ method: "GET", query: { trackId: "not-a-track" } });

  assert.equal(missing.statusCode, 400);
  assert.equal(missing.body.ok, false);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.ok, false);
});

test("GET /api/track returns 503 when persistent library is disabled", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  await __resetMusicLibraryForTests();

  try {
    const response = await callTrackApi({
      method: "GET",
      query: { trackId: "trk_1234567890abcdef1234" }
    });

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.ok, false);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await __resetMusicLibraryForTests();
  }
});

test("GET /api/track returns 404 for unknown cached tracks", async () => {
  const db = newDb();
  registerPgFunctions(db);
  __setMusicLibrarySqlClientForTests(createPgMemSqlTag(db));

  try {
    const response = await callTrackApi({
      method: "GET",
      query: { trackId: "trk_1234567890abcdef1234" }
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.ok, false);
  } finally {
    await __resetMusicLibraryForTests();
  }
});

test("GET /api/track excludes pending manual links from public cards", async () => {
  const { trackId } = await seedPublicTrack({
    links: [
      {
        type: "spotify",
        url: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV",
        isVerified: true,
        source: "spotify_web"
      }
    ]
  });

  try {
    await upsertManualLink({
      trackId,
      platform: "appleMusic",
      url: "https://music.apple.com/us/album/one-more-time/697194953?i=697195462",
      status: "pending",
      confidence: 10
    });

    const response = await callTrackApi({ method: "GET", query: { trackId } });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.data.links.map(link => link.type), ["spotify"]);
    assert.deepEqual(response.body.data.missingPlatforms, ["appleMusic", "deezer", "tidal", "youtube", "youtubeMusic"]);
  } finally {
    await __resetMusicLibraryForTests();
  }
});

test("GET /api/track rejects unsupported methods", async () => {
  const response = await callTrackApi({ method: "POST", query: { trackId: "trk_1234567890abcdef1234" } });

  assert.equal(response.statusCode, 405);
  assert.equal(response.body.ok, false);
});

async function seedPublicTrack(overrides = {}) {
  const db = newDb();
  registerPgFunctions(db);
  __setMusicLibrarySqlClientForTests(createPgMemSqlTag(db));

  const persisted = await upsertCachedResult({
    title: "One More Time",
    description: "Daft Punk",
    album: "Discovery",
    links: overrides.links || [
      {
        type: "spotify",
        url: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV",
        isVerified: true,
        source: "spotify_web"
      },
      {
        type: "appleMusic",
        url: "https://music.apple.com/us/album/one-more-time/697194953?i=697195462",
        isVerified: true,
        source: "itunes"
      },
      {
        type: "deezer",
        url: "https://www.deezer.com/track/3135553",
        isVerified: true,
        source: "deezer_api"
      },
      {
        type: "tidal",
        url: "https://tidal.com/browse/track/75413016",
        isVerified: true,
        source: "tidal_api"
      }
    ]
  }, { defaultSource: "test" });

  return { db, trackId: persisted.trackId };
}

async function callTrackApi({ method = "GET", query = {}, url = "/api/track" } = {}) {
  const req = { method, query, url };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  await trackHandler(req, res);
  return res;
}

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
