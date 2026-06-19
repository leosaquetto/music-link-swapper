import test from "node:test";
import assert from "node:assert/strict";

import { __testHooks } from "../api/convert.js";

const SPOTIFY_TRACK_URL = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

test("Spotify fallback adds a verified Apple Music match when Apple is missing", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url === SPOTIFY_TRACK_URL) {
      return textResponse(buildSpotifyOgHtml({
        title: "Never Gonna Give You Up | Spotify",
        description: "Rick Astley · Song · 1987"
      }));
    }
    if (url.startsWith("https://itunes.apple.com/search")) {
      return jsonResponse({
        results: [
          {
            kind: "song",
            trackName: "Never Gonna Give You Up",
            artistName: "Rick Astley",
            collectionName: "Whenever You Need Somebody",
            trackViewUrl: "https://music.apple.com/br/album/never-gonna-give-you-up/1559885420?i=1559885421&uo=4"
          }
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const result = await __testHooks.enrichWithSpotifyFallback({
      title: "Never Gonna Give You Up",
      description: "Rick Astley",
      links: [
        {
          type: "spotify",
          url: SPOTIFY_TRACK_URL,
          isVerified: true,
          source: "input"
        }
      ]
    });

    const apple = result.links.find(link => link.type === "appleMusic");
    assert.ok(apple);
    assert.equal(apple.isVerified, true);
    assert.equal(apple.source, "itunes");
  });
});

test("Spotify fallback rejects ambiguous Apple Music search matches", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url === SPOTIFY_TRACK_URL) {
      return textResponse(buildSpotifyOgHtml({
        title: "Never Gonna Give You Up | Spotify",
        description: "Rick Astley · Song · 1987"
      }));
    }
    if (url.startsWith("https://itunes.apple.com/search")) {
      return jsonResponse({
        results: [
          {
            kind: "song",
            trackName: "Never Going Home",
            artistName: "Different Artist",
            collectionName: "Different Album",
            trackViewUrl: "https://music.apple.com/us/album/never-going-home/123?i=456"
          }
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const result = await __testHooks.enrichWithSpotifyFallback({
      title: "Never Gonna Give You Up",
      description: "Rick Astley",
      links: [
        {
          type: "spotify",
          url: SPOTIFY_TRACK_URL,
          isVerified: true,
          source: "input"
        }
      ]
    });

    assert.equal(result.links.some(link => link.type === "appleMusic"), false);
  });
});

test("Spotify fallback uses reliable payload metadata when Spotify metadata is unavailable", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url === SPOTIFY_TRACK_URL || url.startsWith("https://open.spotify.com/oembed")) {
      return textResponse("", { ok: false, status: 502 });
    }
    if (url.startsWith("https://itunes.apple.com/search")) {
      return jsonResponse({
        results: [
          {
            kind: "song",
            trackName: "Never Gonna Give You Up",
            artistName: "Rick Astley",
            collectionName: "Whenever You Need Somebody",
            trackViewUrl: "https://music.apple.com/br/album/never-gonna-give-you-up/1559885420?i=1559885421"
          }
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const result = await __testHooks.enrichWithSpotifyFallback({
      title: "Never Gonna Give You Up",
      description: "Rick Astley",
      links: [
        {
          type: "spotify",
          url: SPOTIFY_TRACK_URL,
          isVerified: true,
          source: "input"
        }
      ]
    });

    assert.ok(result.links.find(link => link.type === "appleMusic"));
  });
});

test("Spotify fallback preserves an existing direct Apple Music link", async () => {
  let itunesCalls = 0;

  await withMockFetch(async input => {
    const url = String(input);
    if (url === SPOTIFY_TRACK_URL) {
      return textResponse(buildSpotifyOgHtml({
        title: "Never Gonna Give You Up | Spotify",
        description: "Rick Astley · Song · 1987"
      }));
    }
    if (url.startsWith("https://itunes.apple.com/search")) {
      itunesCalls += 1;
      return jsonResponse({ results: [] });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const appleUrl = "https://music.apple.com/br/album/never-gonna-give-you-up/1559885420?i=1559885421";
    const result = await __testHooks.enrichWithSpotifyFallback({
      title: "Never Gonna Give You Up",
      description: "Rick Astley",
      links: [
        {
          type: "spotify",
          url: SPOTIFY_TRACK_URL,
          isVerified: true,
          source: "input"
        },
        {
          type: "appleMusic",
          url: appleUrl,
          isVerified: true,
          source: "cache"
        }
      ]
    });

    assert.equal(itunesCalls, 0);
    assert.equal(result.links.find(link => link.type === "appleMusic").url, appleUrl);
  });
});

test("Songlink normalization excludes non-automatic platforms", () => {
  const normalized = __testHooks.normalizeSongLinkPayload({
    entityUniqueId: "song::123",
    entitiesByUniqueId: {
      "song::123": {
        title: "One More Time",
        artistName: "Daft Punk",
        albumName: "Discovery"
      }
    },
    linksByPlatform: {
      spotify: { url: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV" },
      appleMusic: { url: "https://music.apple.com/us/album/one-more-time/697194953?i=697195462" },
      youtube: { url: "https://www.youtube.com/watch?v=FGBhQbmPwH8" },
      youtubeMusic: { url: "https://music.youtube.com/watch?v=FGBhQbmPwH8" },
      amazonMusic: { url: "https://music.amazon.com/albums/example" },
      pandora: { url: "https://www.pandora.com/song/example" },
      tidal: { url: "https://tidal.com/browse/track/example" }
    }
  }, { markVerified: true });

  assert.deepEqual(
    normalized.links.map(link => link.type).sort(),
    ["appleMusic", "spotify", "youtube", "youtubeMusic"].sort()
  );
});

async function withMockFetch(fetchImpl, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function buildSpotifyOgHtml({ title, description }) {
  return `
    <html>
      <head>
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="https://i.scdn.co/image/test">
      </head>
    </html>
  `;
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body
  };
}

function textResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => body
  };
}
