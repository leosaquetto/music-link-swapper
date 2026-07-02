import test from "node:test";
import assert from "node:assert/strict";

import { newDb } from "pg-mem";

import trackHandler, { injectSharePreviewMeta } from "../api/track.js";
import {
  __resetMusicLibraryForTests,
  __setMusicLibrarySqlClientForTests,
  upsertCachedResult
} from "../server/lib/music-library.js";

test("GET / injects track-specific Open Graph preview metadata", async () => {
  const db = newDb();
  registerPgFunctions(db);
  __setMusicLibrarySqlClientForTests(createPgMemSqlTag(db));

  try {
    const persisted = await upsertCachedResult({
      title: "Read My Lips (FIFA Version)",
      description: "Madonna & Feid",
      album: "Official FIFA World Cup 2026 Album",
      image: "https://is1-ssl.mzstatic.com/image/thumb/test/600x600bb.jpg",
      durationMs: 166000,
      links: [
        {
          type: "spotify",
          url: "https://open.spotify.com/track/3aRCjlhDyStousHqYnGZ5G",
          isVerified: true,
          source: "spotify_web"
        }
      ]
    });

    const response = await callPageApi({
      query: { track: persisted.trackId },
      headers: {
        host: "swapper.leosaquetto.com",
        "x-forwarded-proto": "https"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<meta property="og:title" content="Read My Lips \(FIFA Version\) de Madonna &amp; Feid no Music Swapper" \/>/);
    assert.match(response.body, /<meta property="og:description" content="Música · 2026 · Duração 2:46" \/>/);
    assert.match(response.body, /<meta property="og:logo" content="https:\/\/swapper\.leosaquetto\.com\/assets\/logo\.png" \/>/);
    assert.match(response.body, /<meta property="og:image" content="https:\/\/is1-ssl\.mzstatic\.com\/image\/thumb\/test\/600x600bb\.jpg" \/>/);
    assert.match(response.body, /<meta name="twitter:card" content="summary_large_image" \/>/);
    assert.match(response.body, /<link rel="apple-touch-icon" href="https:\/\/swapper\.leosaquetto\.com\/assets\/logo\.png" \/>/);
    assert.match(response.body, new RegExp(`<link rel="canonical" href="https://swapper\\.leosaquetto\\.com/\\?track=${persisted.trackId}" />`));
  } finally {
    await __resetMusicLibraryForTests();
  }
});

test("preview meta injection escapes title and description values", () => {
  const html = '<html><head><title>music link swapper</title><link rel="canonical" href="https://swapper.leosaquetto.com/" /><meta property="og:url" content="https://swapper.leosaquetto.com/" /></head></html>';
  const output = injectSharePreviewMeta(html, {
    canonicalUrl: "https://swapper.leosaquetto.com/?track=trk_test",
    description: 'Artist & "Friend"',
    documentTitle: 'Song <Mix> - Artist & "Friend"',
    image: "https://swapper.leosaquetto.com/assets/logo.png",
    imageAlt: 'Song <Mix> - Artist & "Friend"',
    siteName: "music link swapper",
    title: 'Song <Mix> & "Version"',
    type: "music.song"
  });

  assert.match(output, /<title>Song &lt;Mix&gt; - Artist &amp; "Friend"<\/title>/);
  assert.match(output, /content="Song &lt;Mix&gt; &amp; &quot;Version&quot;"/);
  assert.match(output, /content="Artist &amp; &quot;Friend&quot;"/);
});

async function callPageApi({ method = "GET", query = {}, headers = {}, url = "/" } = {}) {
  const req = { method, query, headers, url };
  const res = {
    statusCode: 200,
    body: "",
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    end() {
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
