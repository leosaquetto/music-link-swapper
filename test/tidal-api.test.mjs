import test from "node:test";
import assert from "node:assert/strict";

import tidalSearchHandler from "../api/tidal/search.js";
import {
  __resetTidalTokenCacheForTests,
  extractTidalTrackId,
  fetchTidalTrackById,
  findBestTidalTrack,
  searchTidalTracks
} from "../api/lib/tidal.js";

test("TIDAL helpers parse direct track URLs and normalize hydrated search results", async () => {
  assert.equal(extractTidalTrackId("https://tidal.com/browse/track/75413016?utm=1"), "75413016");
  assert.equal(extractTidalTrackId("https://tidal.com/track/75413016"), "75413016");
  assert.equal(extractTidalTrackId("https://tidal.com/browse/album/75413016"), "");
  assert.equal(extractTidalTrackId("https://tidal.com/search/daft%20punk"), "");

  await withMockTidalFetch(async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.href === "https://auth.tidal.com/v1/oauth2/token") {
      assert.match(String(options.headers?.Authorization || ""), /^Basic /);
      return jsonResponse({ access_token: "test-token", expires_in: 3600, token_type: "Bearer" });
    }

    assert.equal(options.headers?.Authorization, "Bearer test-token");
    if (url.pathname.endsWith("/searchResults/Daft%20Punk%20One%20More%20Time/relationships/tracks")) {
      assert.equal(url.searchParams.get("countryCode"), "BR");
      assert.equal(url.searchParams.get("include"), "tracks");
      assert.equal(url.searchParams.get("page[cursor]"), "cursor-1");
      return jsonResponse({
        data: [{ type: "tracks", id: "75413016" }],
        included: [buildTidalTrackResource({ id: "75413016", title: "One More Time" })],
        links: {
          next: "https://openapi.tidal.com/v2/searchResults/x/relationships/tracks?page%5Bcursor%5D=cursor-2"
        }
      });
    }
    if (url.pathname.endsWith("/tracks/75413016")) {
      assert.equal(url.searchParams.get("countryCode"), "BR");
      assert.equal(url.searchParams.get("include"), "albums,artists");
      return jsonResponse(buildTidalTrackDocument({
        id: "75413016",
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery",
        isrc: "GBDUW0000053"
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const result = await searchTidalTracks({
      q: "Daft Punk One More Time",
      limit: 5,
      cursor: "cursor-1"
    });

    assert.equal(result.countryCode, "BR");
    assert.equal(result.limit, 5);
    assert.equal(result.nextCursor, "cursor-2");
    assert.equal(result.results[0].type, "tidal");
    assert.equal(result.results[0].id, "75413016");
    assert.equal(result.results[0].artist, "Daft Punk");
    assert.equal(result.results[0].album, "Discovery");
    assert.equal(result.results[0].duration, 320);
    assert.equal(result.results[0].url, "https://tidal.com/browse/track/75413016");
    assert.equal(result.results[0].source, "tidal_api");
  });
});

test("TIDAL track lookup handles success and JSON:API no-data responses", async () => {
  await withMockTidalFetch(async input => {
    const url = new URL(String(input));
    if (url.href === "https://auth.tidal.com/v1/oauth2/token") {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    if (url.pathname.endsWith("/tracks/75413016")) {
      return jsonResponse(buildTidalTrackDocument({
        id: "75413016",
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery",
        isrc: "GBDUW0000053"
      }));
    }
    if (url.pathname.endsWith("/tracks/0")) {
      return jsonResponse({
        errors: [{ status: "404", title: "Not Found", detail: "missing track" }]
      }, { ok: false, status: 404 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const track = await fetchTidalTrackById("https://tidal.com/track/75413016");
    assert.equal(track.title, "One More Time");
    assert.equal(track.artist, "Daft Punk");
    assert.equal(track.album, "Discovery");
    assert.equal(track.isrc, "GBDUW0000053");

    const missing = await fetchTidalTrackById("0");
    assert.equal(missing, null);
  });
});

test("TIDAL matching accepts a strong candidate and rejects wrong artists", async () => {
  await withMockTidalFetch(async input => {
    const url = new URL(String(input));
    if (url.href === "https://auth.tidal.com/v1/oauth2/token") {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    if (url.pathname.endsWith("/tracks") && url.searchParams.get("filter[isrc]") === "GBDUW0000053") {
      return jsonResponse({
        data: [
          buildTidalTrackResource({
            id: "75413016",
            title: "One More Time",
            artistId: "artist-1",
            albumId: "album-1",
            duration: "PT5M20S",
            isrc: "GBDUW0000053",
            popularity: 0.95
          })
        ],
        included: [
          buildTidalArtist("artist-1", "Daft Punk"),
          buildTidalAlbum("album-1", "Discovery")
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const match = await findBestTidalTrack({
      title: "One More Time",
      artist: "Daft Punk",
      duration: 320,
      isrc: "GBDUW0000053"
    });
    assert.equal(match.url, "https://tidal.com/browse/track/75413016");
    assert.equal(match.isVerified, true);
  });

  await withMockTidalFetch(async input => {
    const url = new URL(String(input));
    if (url.href === "https://auth.tidal.com/v1/oauth2/token") {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    if (url.pathname.endsWith("/searchResults/Daft%20Punk%20One%20More%20Time/relationships/tracks")) {
      return jsonResponse({ data: [{ type: "tracks", id: "1" }], included: [] });
    }
    if (url.pathname.endsWith("/tracks/1")) {
      return jsonResponse(buildTidalTrackDocument({
        id: "1",
        title: "One More Time",
        artist: "Different Artist",
        album: "Other"
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const match = await findBestTidalTrack({
      title: "One More Time",
      artist: "Daft Punk",
      query: "Daft Punk One More Time"
    });
    assert.equal(match, null);
  });
});

test("GET /api/tidal/search validates input, supports cursor, and maps TIDAL errors", async () => {
  await withMockTidalFetch(async input => {
    const url = new URL(String(input));
    if (url.href === "https://auth.tidal.com/v1/oauth2/token") {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    if (url.pathname.endsWith("/searchResults/Daft%20Punk%20One%20More%20Time/relationships/tracks")) {
      assert.equal(url.searchParams.get("page[cursor]"), "cursor-1");
      return jsonResponse({
        data: [{ type: "tracks", id: "75413016" }],
        included: [],
        links: {
          next: "https://openapi.tidal.com/v2/searchResults/x/relationships/tracks?page%5Bcursor%5D=cursor-2"
        }
      });
    }
    if (url.pathname.endsWith("/tracks/75413016")) {
      return jsonResponse(buildTidalTrackDocument({
        id: "75413016",
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery"
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const response = await callTidalSearchApi({
      query: { q: "Daft Punk One More Time", limit: "5", cursor: "cursor-1" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.limit, 5);
    assert.equal(response.body.data.cursor, "cursor-1");
    assert.equal(response.body.data.nextCursor, "cursor-2");
    assert.equal(response.body.data.results[0].type, "tidal");
  });

  const previousValidationClientId = process.env.TIDAL_CLIENT_ID;
  const previousValidationClientSecret = process.env.TIDAL_CLIENT_SECRET;
  process.env.TIDAL_CLIENT_ID = "test-client";
  process.env.TIDAL_CLIENT_SECRET = "test-secret";
  try {
    const empty = await callTidalSearchApi({ query: { q: "" } });
    assert.equal(empty.statusCode, 400);
  } finally {
    restoreEnv("TIDAL_CLIENT_ID", previousValidationClientId);
    restoreEnv("TIDAL_CLIENT_SECRET", previousValidationClientSecret);
  }

  const method = await callTidalSearchApi({ method: "POST", query: { q: "Daft Punk" } });
  assert.equal(method.statusCode, 405);

  const previousEnabled = process.env.TIDAL_MATCHING_ENABLED;
  process.env.TIDAL_MATCHING_ENABLED = "false";
  try {
    const disabled = await callTidalSearchApi({ query: { q: "Daft Punk" } });
    assert.equal(disabled.statusCode, 503);
  } finally {
    restoreEnv("TIDAL_MATCHING_ENABLED", previousEnabled);
  }

  const previousClientId = process.env.TIDAL_CLIENT_ID;
  const previousClientSecret = process.env.TIDAL_CLIENT_SECRET;
  delete process.env.TIDAL_CLIENT_ID;
  delete process.env.TIDAL_CLIENT_SECRET;
  try {
    const missingCreds = await callTidalSearchApi({ query: { q: "Daft Punk" } });
    assert.equal(missingCreds.statusCode, 503);
  } finally {
    restoreEnv("TIDAL_CLIENT_ID", previousClientId);
    restoreEnv("TIDAL_CLIENT_SECRET", previousClientSecret);
  }

  await withMockTidalFetch(async input => {
    const url = new URL(String(input));
    if (url.href === "https://auth.tidal.com/v1/oauth2/token") {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    return jsonResponse({
      errors: [{ status: "429", title: "Too Many Requests" }]
    }, { ok: false, status: 429 });
  }, async () => {
    const quota = await callTidalSearchApi({ query: { q: "Daft Punk" } });
    assert.equal(quota.statusCode, 503);
  });
});

async function callTidalSearchApi({ method = "GET", query = {}, url = "/api/tidal/search" } = {}) {
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

  await tidalSearchHandler(req, res);
  return res;
}

async function withMockTidalFetch(fetchImpl, run) {
  const originalFetch = globalThis.fetch;
  const previousEnabled = process.env.TIDAL_MATCHING_ENABLED;
  const previousClientId = process.env.TIDAL_CLIENT_ID;
  const previousClientSecret = process.env.TIDAL_CLIENT_SECRET;
  const previousCountryCode = process.env.TIDAL_COUNTRY_CODE;
  process.env.TIDAL_MATCHING_ENABLED = "true";
  process.env.TIDAL_CLIENT_ID = "test-client";
  process.env.TIDAL_CLIENT_SECRET = "test-secret";
  process.env.TIDAL_COUNTRY_CODE = "BR";
  __resetTidalTokenCacheForTests();
  globalThis.fetch = fetchImpl;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("TIDAL_MATCHING_ENABLED", previousEnabled);
    restoreEnv("TIDAL_CLIENT_ID", previousClientId);
    restoreEnv("TIDAL_CLIENT_SECRET", previousClientSecret);
    restoreEnv("TIDAL_COUNTRY_CODE", previousCountryCode);
    __resetTidalTokenCacheForTests();
  }
}

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body
  };
}

function buildTidalTrackDocument({
  id,
  title,
  artist,
  album,
  duration = "PT5M20S",
  isrc = "",
  explicit = false,
  popularity = 0.9
}) {
  return {
    data: buildTidalTrackResource({
      id,
      title,
      artistId: "artist-1",
      albumId: "album-1",
      duration,
      isrc,
      explicit,
      popularity
    }),
    included: [
      buildTidalArtist("artist-1", artist),
      buildTidalAlbum("album-1", album)
    ],
    links: {}
  };
}

function buildTidalTrackResource({
  id,
  title,
  artistId = "artist-1",
  albumId = "album-1",
  duration = "PT5M20S",
  isrc = "",
  explicit = false,
  popularity = 0.9
}) {
  return {
    id: String(id),
    type: "tracks",
    attributes: {
      title,
      duration,
      explicit,
      isrc,
      popularity
    },
    relationships: {
      artists: { data: [{ type: "artists", id: artistId }] },
      albums: { data: [{ type: "albums", id: albumId }] }
    }
  };
}

function buildTidalArtist(id, name) {
  return {
    id,
    type: "artists",
    attributes: {
      name,
      popularity: 0.9
    }
  };
}

function buildTidalAlbum(id, title) {
  return {
    id,
    type: "albums",
    attributes: {
      title,
      popularity: 0.9
    }
  };
}
