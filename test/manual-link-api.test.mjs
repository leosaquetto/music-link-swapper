import test from "node:test";
import assert from "node:assert/strict";

import { newDb } from "pg-mem";

import manualLinkHandler from "../api/manual-link.js";
import {
  __resetMusicLibraryForTests,
  __setMusicLibrarySqlClientForTests,
  upsertCachedResult
} from "../server/lib/music-library.js";

test("manual Spotify correction publishes when base title and artists match", async () => {
  const db = newDb();
  registerPgFunctions(db);
  const sql = createPgMemSqlTag(db);
  __setMusicLibrarySqlClientForTests(sql);

  const previousFetch = global.fetch;
  global.fetch = async input => {
    const url = String(input);
    assert.ok(url.startsWith("https://open.spotify.com/oembed?url="));
    return jsonResponse({
      title: "Read My Lips (FIFA World Cup 2026™) by Madonna, Feid"
    });
  };

  try {
    const persisted = await upsertCachedResult({
      title: "Read My Lips (FIFA Version)",
      description: "Madonna & Feid • Official FIFA World Cup 2026™ Album (Bonus Edition)",
      album: "Official FIFA World Cup 2026™ Album (Bonus Edition)",
      links: [
        {
          type: "appleMusic",
          url: "https://music.apple.com/br/album/read-my-lips-fifa-version/6783929033?i=6783929486",
          isVerified: true,
          source: "input"
        }
      ]
    }, { defaultSource: "unit" });

    const response = await callManualLinkApi({
      body: {
        trackId: persisted.trackId,
        platform: "spotify",
        url: "https://open.spotify.com/track/3aRCjlhDyStousHqYnGZ5G?si=R99a9Wd2Q-u1pJih8P_uJg"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.published, true);
    assert.equal(response.body.data.confidence >= 88, true);
    assert.equal(
      response.body.data.result.links.some(link => (
        link.type === "spotify" &&
        link.url === "https://open.spotify.com/track/3aRCjlhDyStousHqYnGZ5G"
      )),
      true
    );
  } finally {
    global.fetch = previousFetch;
    await __resetMusicLibraryForTests();
  }
});

async function callManualLinkApi({ method = "POST", body = {} } = {}) {
  const req = { method, body };
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

  await manualLinkHandler(req, res);
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

function jsonResponse(payload, { status = 200, ok = true } = {}) {
  return {
    ok,
    status,
    json: async () => payload
  };
}
