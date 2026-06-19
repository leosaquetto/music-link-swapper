import test from "node:test";
import assert from "node:assert/strict";

import deezerSearchHandler from "../api/deezer/search.js";
import {
  extractDeezerTrackId,
  fetchDeezerTrackById,
  findBestDeezerTrack,
  searchDeezerTracks
} from "../api/lib/deezer.js";

test("Deezer helpers parse direct track URLs and normalize search results", async () => {
  assert.equal(extractDeezerTrackId("https://www.deezer.com/br/track/3135553?utm=1"), "3135553");
  assert.equal(extractDeezerTrackId("https://www.deezer.com/search/daft%20punk"), "");

  await withMockFetch(async input => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/search/track");
    assert.equal(url.searchParams.get("q"), "Daft Punk One More Time");
    assert.equal(url.searchParams.get("limit"), "2");
    assert.equal(url.searchParams.get("index"), "3");
    return jsonResponse({
      total: 51,
      data: [
        buildDeezerTrack({
          id: 3135553,
          title: "One More Time",
          artist: "Daft Punk",
          album: "Discovery",
          isrc: "GBDUW0000053",
          link: "https://www.deezer.com/track/3135553?utm_source=test"
        })
      ]
    });
  }, async () => {
    const result = await searchDeezerTracks({
      q: "Daft Punk One More Time",
      limit: 2,
      index: 3
    });

    assert.equal(result.total, 51);
    assert.equal(result.results[0].type, "deezer");
    assert.equal(result.results[0].id, "3135553");
    assert.equal(result.results[0].url, "https://www.deezer.com/track/3135553");
    assert.equal(result.results[0].source, "deezer_api");
  });
});

test("Deezer track lookup handles success and API no-data payloads", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url.endsWith("/track/3135553")) {
      return jsonResponse(buildDeezerTrack({
        id: 3135553,
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery",
        isrc: "GBDUW0000053"
      }));
    }
    if (url.endsWith("/track/0")) {
      return jsonResponse({
        error: {
          type: "DataException",
          message: "no data",
          code: 800
        }
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const track = await fetchDeezerTrackById("3135553");
    assert.equal(track.title, "One More Time");
    assert.equal(track.artist, "Daft Punk");
    assert.equal(track.isrc, "GBDUW0000053");

    const missing = await fetchDeezerTrackById("0");
    assert.equal(missing, null);
  });
});

test("Deezer matching accepts a strong candidate and rejects wrong artists", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url.startsWith("https://api.deezer.com/search/track")) {
      return jsonResponse({
        total: 2,
        data: [
          buildDeezerTrack({
            id: 1,
            title: "One More Time",
            artist: "Daft Punk",
            album: "Discovery",
            duration: 320,
            rank: 900000
          }),
          buildDeezerTrack({
            id: 2,
            title: "One More Time",
            artist: "Different Artist",
            album: "Other",
            duration: 320
          })
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const match = await findBestDeezerTrack({
      title: "One More Time",
      artist: "Daft Punk",
      duration: 320
    });
    assert.equal(match.url, "https://www.deezer.com/track/1");
    assert.equal(match.isVerified, true);
  });

  await withMockFetch(async input => {
    const url = String(input);
    if (url.startsWith("https://api.deezer.com/search/track")) {
      return jsonResponse({
        total: 1,
        data: [
          buildDeezerTrack({
            id: 3,
            title: "One More Time",
            artist: "Different Artist",
            album: "Other"
          })
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const match = await findBestDeezerTrack({
      title: "One More Time",
      artist: "Daft Punk"
    });
    assert.equal(match, null);
  });
});

test("GET /api/deezer/search validates input, supports pagination, and maps Deezer errors", async () => {
  await withMockFetch(async input => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/search/track");
    assert.equal(url.searchParams.get("q"), "Daft Punk One More Time");
    assert.equal(url.searchParams.get("limit"), "5");
    assert.equal(url.searchParams.get("index"), "2");
    return jsonResponse({
      total: 1,
      data: [
        buildDeezerTrack({ id: 3135553, title: "One More Time", artist: "Daft Punk" })
      ]
    });
  }, async () => {
    const response = await callDeezerSearchApi({
      query: { q: "Daft Punk One More Time", limit: "5", index: "2" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.limit, 5);
    assert.equal(response.body.data.index, 2);
    assert.equal(response.body.data.results[0].type, "deezer");
  });

  const empty = await callDeezerSearchApi({ query: { q: "" } });
  assert.equal(empty.statusCode, 400);

  const method = await callDeezerSearchApi({ method: "POST", query: { q: "Daft Punk" } });
  assert.equal(method.statusCode, 405);

  const previousEnabled = process.env.DEEZER_MATCHING_ENABLED;
  process.env.DEEZER_MATCHING_ENABLED = "false";
  try {
    const disabled = await callDeezerSearchApi({ query: { q: "Daft Punk" } });
    assert.equal(disabled.statusCode, 503);
  } finally {
    restoreEnv("DEEZER_MATCHING_ENABLED", previousEnabled);
  }

  await withMockFetch(async () => jsonResponse({
    error: {
      type: "Exception",
      message: "quota",
      code: 4
    }
  }), async () => {
    const quota = await callDeezerSearchApi({ query: { q: "Daft Punk" } });
    assert.equal(quota.statusCode, 503);
  });
});

async function callDeezerSearchApi({ method = "GET", query = {}, url = "/api/deezer/search" } = {}) {
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

  await deezerSearchHandler(req, res);
  return res;
}

async function withMockFetch(fetchImpl, run) {
  const originalFetch = globalThis.fetch;
  const previousEnabled = process.env.DEEZER_MATCHING_ENABLED;
  process.env.DEEZER_MATCHING_ENABLED = "true";
  globalThis.fetch = fetchImpl;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("DEEZER_MATCHING_ENABLED", previousEnabled);
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

function buildDeezerTrack({
  id,
  title,
  artist,
  album = "",
  duration = 320,
  isrc = "",
  link = "",
  readable = true,
  rank = 500000
}) {
  return {
    id,
    title,
    title_short: title,
    link: link || `https://www.deezer.com/track/${id}`,
    duration,
    isrc,
    readable,
    rank,
    artist: { name: artist },
    album: {
      title: album,
      cover_medium: "https://e-cdns-images.dzcdn.net/images/cover/test/250x250-000000-80-0-0.jpg"
    }
  };
}
