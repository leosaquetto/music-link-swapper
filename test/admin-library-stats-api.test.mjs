import test from "node:test";
import assert from "node:assert/strict";

import { newDb } from "pg-mem";

import adminStatsHandler from "../api/admin/library-stats.js";
import {
  __resetMusicLibraryForTests,
  __setMusicLibrarySqlClientForTests,
  recordProviderAttempt,
  upsertCachedResult
} from "../server/lib/music-library.js";

test("GET /api/admin/library-stats requires configured admin token", async () => {
  const previousToken = process.env.ADMIN_STATS_TOKEN;
  delete process.env.ADMIN_STATS_TOKEN;

  try {
    const response = await callAdminStatsApi({
      method: "GET",
      query: { token: "anything" }
    });

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.ok, false);
  } finally {
    restoreEnv("ADMIN_STATS_TOKEN", previousToken);
  }
});

test("GET /api/admin/library-stats rejects wrong token and methods", async () => {
  const previousToken = process.env.ADMIN_STATS_TOKEN;
  process.env.ADMIN_STATS_TOKEN = "correct-token";

  try {
    const wrongToken = await callAdminStatsApi({
      method: "GET",
      query: { token: "wrong-token" }
    });
    const wrongMethod = await callAdminStatsApi({
      method: "POST",
      query: { token: "correct-token" }
    });

    assert.equal(wrongToken.statusCode, 401);
    assert.equal(wrongToken.body.ok, false);
    assert.equal(wrongMethod.statusCode, 405);
    assert.equal(wrongMethod.body.ok, false);
  } finally {
    restoreEnv("ADMIN_STATS_TOKEN", previousToken);
  }
});

test("GET /api/admin/library-stats supports CORS preflight for shortcut HTML", async () => {
  const response = await callAdminStatsApi({ method: "OPTIONS" });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "*");
  assert.match(response.headers["access-control-allow-headers"], /Authorization/);
});

test("GET /api/admin/library-stats returns cache, daily, source, and provider diagnostics", async () => {
  const db = newDb();
  registerPgFunctions(db);
  __setMusicLibrarySqlClientForTests(createPgMemSqlTag(db));

  const previousToken = process.env.ADMIN_STATS_TOKEN;
  process.env.ADMIN_STATS_TOKEN = "diagnostic-token";

  try {
    await upsertCachedResult(
      {
        title: "One More Time",
        description: "Daft Punk",
        album: "Discovery",
        links: [
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
          }
        ]
      },
      {
        aliases: ["https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV?si=admin-test"],
        defaultSource: "unit"
      }
    );

    await recordProviderAttempt({
      trackKey: "track:one more time|artist:daft punk",
      provider: "spotify_web",
      status: "hit",
      latencyMs: 11,
      message: "spotify"
    });
    await recordProviderAttempt({
      trackKey: "track:one more time|artist:daft punk",
      provider: "deezer_api",
      status: "miss",
      latencyMs: 22,
      message: "no_match"
    });

    const response = await callAdminStatsApi({
      method: "GET",
      query: { token: "diagnostic-token", days: "7", limit: "10" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.totals.tracks, 1);
    assert.equal(response.body.data.totals.publishedLinks, 2);
    assert.equal(response.body.data.totals.aliases, 1);
    assert.equal(response.body.data.totals.providerAttempts, 2);
    assert.deepEqual(response.body.data.platforms.automatic, ["spotify", "appleMusic", "deezer", "youtube", "youtubeMusic"]);
    assert.equal(response.body.data.platforms.completeTracks, 0);
    assert.equal(
      response.body.data.platforms.byPlatform.find(item => item.platform === "deezer").missingTracks,
      1
    );
    assert.equal(response.body.data.sources.some(item => item.source === "spotify_web"), true);
    assert.equal(response.body.data.daily.length > 0, true);
    assert.equal(response.body.data.recent.trackedInputs[0].alias, "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV");
    assert.equal(response.body.data.recent.providerIssues[0].provider, "deezer_api");
    assert.equal(response.body.data.providerHealth.last24h.some(item => item.provider === "deezer_api" && item.miss === 1), true);
  } finally {
    restoreEnv("ADMIN_STATS_TOKEN", previousToken);
    await __resetMusicLibraryForTests();
  }
});

async function callAdminStatsApi({ method = "GET", query = {}, url = "/api/admin/library-stats", headers = {} } = {}) {
  const req = { method, query, url, headers };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  await adminStatsHandler(req, res);
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

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
