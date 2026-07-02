import test from "node:test";
import assert from "node:assert/strict";

import convertHandler, { __testHooks } from "../api/convert.js";
import { __resetRapidApiQuotaForTests } from "../server/lib/rapidapi-music.js";

const SPOTIFY_TRACK_URL = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";
process.env.DEEZER_MATCHING_ENABLED = "false";

test("Apple input metadata preserves duration for cached provider upgrades", async () => {
  const appleUrl = "https://music.apple.com/us/album/golden/1820264137?i=1820264150&uo=4";
  await withMockFetch(async input => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/lookup");
    assert.equal(url.searchParams.get("id"), "1820264150");
    return jsonResponse({
      results: [
        {
          kind: "song",
          trackName: "Golden",
          artistName: "HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast",
          collectionName: "KPop Demon Hunters (Soundtrack from the Netflix Film)",
          trackTimeMillis: 194608,
          trackViewUrl: appleUrl
        }
      ]
    });
  }, async () => {
    const inputContext = await __testHooks.buildInputCacheContext(appleUrl, "appleMusic");
    const prepared = __testHooks.prepareCachedResultForUpgrade({
      title: "Golden",
      description: "HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast",
      links: [],
      missingPlatforms: ["deezer"]
    }, inputContext);

    assert.equal(inputContext.durationMs, 194608);
    assert.equal(prepared.durationMs, 194608);
  });
});

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

test("RapidAPI Spotify fallback adds a direct Spotify link when enabled", async () => {
  const previousEnabled = process.env.RAPIDAPI_FALLBACKS_ENABLED;
  const previousKey = process.env.RAPIDAPI_KEY;
  const previousSpotify = process.env.RAPIDAPI_SPOTIFY_ENABLED;
  process.env.RAPIDAPI_FALLBACKS_ENABLED = "true";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";
  process.env.RAPIDAPI_SPOTIFY_ENABLED = "true";
  __resetRapidApiQuotaForTests();

  await withMockFetch(async input => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "spotify23.p.rapidapi.com");
    return textResponse(JSON.stringify({
      tracks: {
        items: [
          {
            data: {
              id: "0DiWol3AO6WpXZgp0goxAV",
              uri: "spotify:track:0DiWol3AO6WpXZgp0goxAV",
              name: "One More Time",
              artists: { items: [{ profile: { name: "Daft Punk" } }] },
              albumOfTrack: { name: "Discovery" },
              duration: { totalMilliseconds: 320000 }
            }
          }
        ]
      }
    }));
  }, async () => {
    try {
      const result = await __testHooks.enrichWithRapidApiSpotifyMatch({
        title: "One More Time",
        description: "Daft Punk",
        album: "Discovery",
        durationMs: 320000,
        links: []
      });

      const spotify = result.links.find(link => link.type === "spotify");
      assert.ok(spotify);
      assert.equal(spotify.url, "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV");
      assert.equal(spotify.source, "rapidapi_spotify23");
    } finally {
      restoreEnv("RAPIDAPI_FALLBACKS_ENABLED", previousEnabled);
      restoreEnv("RAPIDAPI_KEY", previousKey);
      restoreEnv("RAPIDAPI_SPOTIFY_ENABLED", previousSpotify);
      __resetRapidApiQuotaForTests();
    }
  });
});

test("RapidAPI Spotify Web API3 fallback runs after Spotify23 misses", async () => {
  const previousEnabled = process.env.RAPIDAPI_FALLBACKS_ENABLED;
  const previousKey = process.env.RAPIDAPI_KEY;
  const previousSpotify = process.env.RAPIDAPI_SPOTIFY_ENABLED;
  const previousSpotifyWebApi3 = process.env.RAPIDAPI_SPOTIFY_WEB_API3_ENABLED;
  process.env.RAPIDAPI_FALLBACKS_ENABLED = "true";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";
  process.env.RAPIDAPI_SPOTIFY_ENABLED = "true";
  process.env.RAPIDAPI_SPOTIFY_WEB_API3_ENABLED = "true";
  __resetRapidApiQuotaForTests();

  await withMockFetch(async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.hostname === "spotify23.p.rapidapi.com") {
      return textResponse(JSON.stringify({ tracks: { items: [] } }));
    }
    if (url.hostname === "spotify-web-api3.p.rapidapi.com") {
      assert.equal(options.method, "POST");
      return textResponse(JSON.stringify({
        tracks: [
          {
            track: "The Kill",
            link: "https://open.spotify.com/track/4rRNDclay9ayn1iR1VpMMB",
            artist: "Thirty Seconds To Mars"
          }
        ]
      }));
    }
    throw new Error(`unexpected fetch: ${url.toString()}`);
  }, async () => {
    try {
      const result = await __testHooks.enrichWithRapidApiSpotifyMatch({
        title: "The Kill",
        description: "Thirty Seconds To Mars",
        links: []
      });

      const spotify = result.links.find(link => link.type === "spotify");
      assert.ok(spotify);
      assert.equal(spotify.url, "https://open.spotify.com/track/4rRNDclay9ayn1iR1VpMMB");
      assert.equal(spotify.source, "rapidapi_spotify_web_api3");
    } finally {
      restoreEnv("RAPIDAPI_FALLBACKS_ENABLED", previousEnabled);
      restoreEnv("RAPIDAPI_KEY", previousKey);
      restoreEnv("RAPIDAPI_SPOTIFY_ENABLED", previousSpotify);
      restoreEnv("RAPIDAPI_SPOTIFY_WEB_API3_ENABLED", previousSpotifyWebApi3);
      __resetRapidApiQuotaForTests();
    }
  });
});

test("Spotify Web matching builds a simplified retry for alternate version titles", () => {
  const attempts = __testHooks.buildSpotifyWebMatchAttempts({
    title: "Read My Lips (FIFA Version)",
    artist: "Madonna & Feid • Official FIFA World Cup 2026™ Album (Bonus Edition)"
  });

  assert.equal(attempts[0].query, "Read My Lips (FIFA Version) Madonna & Feid");
  assert.equal(attempts[1].query, "Read My Lips Madonna Feid");
});

test("RapidAPI Shazam fallback adds a direct Apple Music link when enabled", async () => {
  const previousEnabled = process.env.RAPIDAPI_FALLBACKS_ENABLED;
  const previousKey = process.env.RAPIDAPI_KEY;
  const previousShazam = process.env.RAPIDAPI_SHAZAM_ENABLED;
  process.env.RAPIDAPI_FALLBACKS_ENABLED = "true";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";
  process.env.RAPIDAPI_SHAZAM_ENABLED = "true";
  __resetRapidApiQuotaForTests();

  await withMockFetch(async input => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "shazam.p.rapidapi.com");
    return textResponse(JSON.stringify({
      tracks: {
        hits: [
          {
            track: {
              key: "20066955",
              title: "Kiss The Rain",
              subtitle: "Billie Myers",
              images: { coverart: "https://example.com/cover.jpg" },
              hub: {
                actions: [{ type: "applemusicplay", id: "1444027955" }],
                options: [
                  {
                    actions: [
                      {
                        type: "applemusicopen",
                        uri: "https://music.apple.com/us/album/kiss-the-rain/1444027943?i=1444027955&mttnagencyid=s2n"
                      }
                    ]
                  }
                ],
                providers: [
                  {
                    type: "SPOTIFY",
                    actions: [{ type: "uri", uri: "spotify:search:Kiss%20The%20Rain%20Billie%20Myers" }]
                  }
                ]
              }
            }
          }
        ]
      }
    }));
  }, async () => {
    try {
      const result = await __testHooks.enrichWithRapidApiShazamAppleMusic({
        title: "Kiss The Rain",
        description: "Billie Myers",
        links: []
      });

      const appleMusic = result.links.find(link => link.type === "appleMusic");
      assert.ok(appleMusic);
      assert.equal(appleMusic.url, "https://music.apple.com/us/album/kiss-the-rain/1444027943?i=1444027955");
      assert.equal(appleMusic.source, "rapidapi_shazam");
      assert.equal(result.links.some(link => String(link.url || "").startsWith("spotify:search:")), false);
    } finally {
      restoreEnv("RAPIDAPI_FALLBACKS_ENABLED", previousEnabled);
      restoreEnv("RAPIDAPI_KEY", previousKey);
      restoreEnv("RAPIDAPI_SHAZAM_ENABLED", previousShazam);
      __resetRapidApiQuotaForTests();
    }
  });
});

test("YouTube Music cold path adds Apple after Spotify Web matching", async () => {
  const previousStatslc = process.env.STATSLC_BRIDGE_ENABLED;
  const previousSpotifyWeb = process.env.SPOTIFY_WEB_MATCHING_ENABLED;
  process.env.STATSLC_BRIDGE_ENABLED = "false";
  process.env.SPOTIFY_WEB_MATCHING_ENABLED = "true";

  await withMockFetch(async input => {
    const url = String(input);

    if (url === "https://open.spotify.com/api/server-time") {
      return jsonResponse({ serverTime: 1234567890 });
    }

    if (url === "https://open.spotify.com") {
      return textResponse(`"<https://example.test/mobile-web-player.a1b2c3.js>"`.replace("<", "").replace(">", ""));
    }

    if (url === "https://example.test/mobile-web-player.a1b2c3.js") {
      return textResponse(`const data = { secret: "abc123", version: 1 };`);
    }

    if (url.startsWith("https://open.spotify.com/api/token")) {
      return jsonResponse({
        accessToken: "spotify-web-token",
        accessTokenExpirationTimestampMs: Date.now() + 60_000
      });
    }

    if (url.startsWith("https://api-partner.spotify.com/pathfinder/v1/query")) {
      return jsonResponse({
        data: {
          searchV2: {
            tracks: {
              items: [
                {
                  track: {
                    name: "Fight Like A Girl (feat. K.Flay)",
                    uri: "spotify:track:6TUYOU8S2s5l8zgdHeVsjZ",
                    artists: {
                      items: [
                        { profile: { name: "Evanescence" } }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      });
    }

    if (url.startsWith("https://itunes.apple.com/search")) {
      return jsonResponse({
        results: [
          {
            kind: "song",
            trackName: "Fight Like A Girl (feat. K.Flay)",
            artistName: "Evanescence",
            collectionName: "Fight Like A Girl (feat. K.Flay) - Single",
            trackViewUrl: "https://music.apple.com/us/album/fight-like-a-girl-feat-k-flay/1816243805?i=1816243806&uo=4"
          }
        ]
      });
    }

    return textResponse("", { ok: false, status: 502 });
  }, async () => {
    try {
      const result = await __testHooks.finalizeResultData({
        title: "Fight Like A Girl (feat. K.Flay)",
        description: "Evanescence",
        links: [
          {
            type: "youtubeMusic",
            url: "https://music.youtube.com/watch?v=15qCAHaw4Xw",
            isVerified: true,
            source: "input"
          }
        ]
      });

      assert.ok(result.links.find(link => link.type === "spotify"));
      assert.ok(result.links.find(link => link.type === "youtube"));
      assert.ok(result.links.find(link => link.type === "youtubeMusic"));
      const apple = result.links.find(link => link.type === "appleMusic");
      assert.ok(apple);
      assert.equal(apple.source, "itunes");
    } finally {
      restoreEnv("STATSLC_BRIDGE_ENABLED", previousStatslc);
      restoreEnv("SPOTIFY_WEB_MATCHING_ENABLED", previousSpotifyWeb);
    }
  });
});

test("partial YouTube Music cache upgrades with clean input metadata before matching", async () => {
  const previousStatslc = process.env.STATSLC_BRIDGE_ENABLED;
  const previousSpotifyWeb = process.env.SPOTIFY_WEB_MATCHING_ENABLED;
  process.env.STATSLC_BRIDGE_ENABLED = "false";
  process.env.SPOTIFY_WEB_MATCHING_ENABLED = "true";

  await withMockFetch(async input => {
    const url = String(input);

    if (url === "https://open.spotify.com/api/server-time") {
      return jsonResponse({ serverTime: 1234567890 });
    }

    if (url === "https://open.spotify.com") {
      return textResponse(`"<https://example.test/mobile-web-player.a1b2c3.js>"`.replace("<", "").replace(">", ""));
    }

    if (url === "https://example.test/mobile-web-player.a1b2c3.js") {
      return textResponse(`const data = { secret: "abc123", version: 1 };`);
    }

    if (url.startsWith("https://open.spotify.com/api/token")) {
      return jsonResponse({
        accessToken: "spotify-web-token",
        accessTokenExpirationTimestampMs: Date.now() + 60_000
      });
    }

    if (url.startsWith("https://api-partner.spotify.com/pathfinder/v1/query")) {
      return jsonResponse({
        data: {
          searchV2: {
            tracks: {
              items: [
                {
                  track: {
                    name: "Don't Tell Me",
                    uri: "spotify:track:6sqNctd7MlJoKDOxPVCAvU",
                    artists: {
                      items: [
                        { profile: { name: "Avril Lavigne" } }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      });
    }

    if (url.startsWith("https://itunes.apple.com/search")) {
      return jsonResponse({
        results: [
          {
            kind: "song",
            trackName: "Don't Tell Me",
            artistName: "Avril Lavigne",
            collectionName: "Under My Skin",
            trackViewUrl: "https://music.apple.com/us/album/dont-tell-me/1440857781?i=1440857792&uo=4"
          }
        ]
      });
    }

    return textResponse("", { ok: false, status: 502 });
  }, async () => {
    try {
      const prepared = __testHooks.prepareCachedResultForUpgrade(
        {
          title: "música encontrada",
          description: "Grupo Accion Oaxaca",
          links: [
            {
              type: "youtube",
              url: "https://www.youtube.com/watch?v=qHqEcMqqGAA",
              isVerified: true,
              source: "cache"
            },
            {
              type: "youtubeMusic",
              url: "https://music.youtube.com/watch?v=qHqEcMqqGAA",
              isVerified: true,
              source: "cache"
            }
          ],
          missingPlatforms: ["spotify", "appleMusic"]
        },
        {
          title: "Don't Tell Me",
          artist: "Avril Lavigne",
          image: "https://i.ytimg.com/vi/qHqEcMqqGAA/hqdefault.jpg"
        }
      );

      const result = await __testHooks.finalizeResultData(prepared);

      assert.equal(result.title, "Don't Tell Me");
      assert.equal(result.description, "Avril Lavigne");
      assert.ok(result.links.find(link => link.type === "spotify"));
      assert.ok(result.links.find(link => link.type === "youtube"));
      assert.ok(result.links.find(link => link.type === "youtubeMusic"));
      const apple = result.links.find(link => link.type === "appleMusic");
      assert.ok(apple);
      assert.equal(apple.source, "itunes");
    } finally {
      restoreEnv("STATSLC_BRIDGE_ENABLED", previousStatslc);
      restoreEnv("SPOTIFY_WEB_MATCHING_ENABLED", previousSpotifyWeb);
    }
  });
});

test("YouTube input context reads clean title and artist from oEmbed", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url.startsWith("https://www.youtube.com/oembed")) {
      return jsonResponse({
        title: "Time",
        author_name: "Bebe Rexha - Topic",
        thumbnail_url: "https://i.ytimg.com/vi/viJzrnayC2E/hqdefault.jpg"
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const context = await __testHooks.buildInputCacheContext(
      "https://music.youtube.com/watch?v=viJzrnayC2E&si=SIJo04ifRfFl4Oxz",
      "youtube music"
    );

    assert.equal(context.title, "Time");
    assert.equal(context.artist, "Bebe Rexha");
    assert.equal(context.canonicalKey, "track:time|artist:bebe rexha");
  });
});

test("YouTube input context falls back to noembed when YouTube oEmbed fails", async () => {
  await withMockFetch(async input => {
    const url = String(input);
    if (url.startsWith("https://www.youtube.com/oembed")) {
      return textResponse("", { ok: false, status: 502 });
    }
    if (url.startsWith("https://noembed.com/embed")) {
      return jsonResponse({
        title: "Don't Tell Me",
        author_name: "Avril Lavigne - Topic",
        thumbnail_url: "https://i.ytimg.com/vi/qHqEcMqqGAA/hqdefault.jpg"
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const context = await __testHooks.buildInputCacheContext(
      "https://music.youtube.com/watch?v=qHqEcMqqGAA&si=i2uUWEPKuBXUlCy8",
      "youtubeMusic"
    );

    assert.equal(context.title, "Don't Tell Me");
    assert.equal(context.artist, "Avril Lavigne");
    assert.equal(context.canonicalKey, "track:don t tell me|artist:avril lavigne");
  });
});

test("YouTube input context falls back to YouTube Data metadata when public embeds fail", async () => {
  const previousKey = process.env.YOUTUBE_API_KEY;
  const previousMatching = process.env.YOUTUBE_MATCHING_ENABLED;
  process.env.YOUTUBE_API_KEY = "test-youtube-key";
  process.env.YOUTUBE_MATCHING_ENABLED = "true";

  await withMockFetch(async input => {
    const url = String(input);
    if (url.startsWith("https://www.youtube.com/oembed")) {
      return textResponse("", { ok: false, status: 502 });
    }
    if (url.startsWith("https://noembed.com/embed")) {
      return textResponse("", { ok: false, status: 502 });
    }
    if (url.startsWith("https://www.googleapis.com/youtube/v3/videos")) {
      return jsonResponse({
        items: [
          {
            snippet: {
              title: "Don't Tell Me",
              channelTitle: "Avril Lavigne - Topic",
              thumbnails: {
                high: {
                  url: "https://i.ytimg.com/vi/qHqEcMqqGAA/hqdefault.jpg"
                }
              }
            }
          }
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    try {
      const context = await __testHooks.buildInputCacheContext(
        "https://music.youtube.com/watch?v=qHqEcMqqGAA&si=i2uUWEPKuBXUlCy8",
        "youtubeMusic"
      );

      assert.equal(context.title, "Don't Tell Me");
      assert.equal(context.artist, "Avril Lavigne");
      assert.equal(context.canonicalKey, "track:don t tell me|artist:avril lavigne");
    } finally {
      restoreEnv("YOUTUBE_API_KEY", previousKey);
      restoreEnv("YOUTUBE_MATCHING_ENABLED", previousMatching);
    }
  });
});

test("YouTube input context uses RapidAPI MusicData before YouTube Data API", async () => {
  const previousRapidEnabled = process.env.RAPIDAPI_FALLBACKS_ENABLED;
  const previousRapidKey = process.env.RAPIDAPI_KEY;
  const previousMusicData = process.env.RAPIDAPI_MUSICDATA_ENABLED;
  const previousYoutubeKey = process.env.YOUTUBE_API_KEY;
  const previousYoutubeMatching = process.env.YOUTUBE_MATCHING_ENABLED;
  process.env.RAPIDAPI_FALLBACKS_ENABLED = "true";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";
  process.env.RAPIDAPI_MUSICDATA_ENABLED = "true";
  process.env.YOUTUBE_API_KEY = "test-youtube-key";
  process.env.YOUTUBE_MATCHING_ENABLED = "true";
  __resetRapidApiQuotaForTests();

  await withMockFetch(async input => {
    const url = String(input);
    if (url.startsWith("https://www.youtube.com/oembed")) {
      return textResponse("", { ok: false, status: 502 });
    }
    if (url.startsWith("https://noembed.com/embed")) {
      return textResponse("", { ok: false, status: 502 });
    }
    if (url.startsWith("https://musicdata-api.p.rapidapi.com/youtube/video/")) {
      return textResponse(JSON.stringify([
        {
          track: "Avril Lavigne - Keep Holding On (Official Lyric Video)",
          link: "https://www.youtube.com/watch/ZtdcRMgAU0A"
        }
      ]));
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    try {
      const context = await __testHooks.buildInputCacheContext(
        "https://music.youtube.com/watch?v=ZtdcRMgAU0A",
        "youtubeMusic"
      );

      assert.equal(context.title, "Keep Holding On");
      assert.equal(context.artist, "Avril Lavigne");
      assert.equal(context.canonicalKey, "track:keep holding on|artist:avril lavigne");
    } finally {
      restoreEnv("RAPIDAPI_FALLBACKS_ENABLED", previousRapidEnabled);
      restoreEnv("RAPIDAPI_KEY", previousRapidKey);
      restoreEnv("RAPIDAPI_MUSICDATA_ENABLED", previousMusicData);
      restoreEnv("YOUTUBE_API_KEY", previousYoutubeKey);
      restoreEnv("YOUTUBE_MATCHING_ENABLED", previousYoutubeMatching);
      __resetRapidApiQuotaForTests();
    }
  });
});

test("RapidAPI YouTube Music fallback adds paired YouTube links when enabled", async () => {
  const previousEnabled = process.env.RAPIDAPI_FALLBACKS_ENABLED;
  const previousKey = process.env.RAPIDAPI_KEY;
  const previousYoutubeMusic = process.env.RAPIDAPI_YOUTUBE_MUSIC_ENABLED;
  process.env.RAPIDAPI_FALLBACKS_ENABLED = "true";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";
  process.env.RAPIDAPI_YOUTUBE_MUSIC_ENABLED = "true";
  __resetRapidApiQuotaForTests();

  await withMockFetch(async input => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "youtube-music-api3.p.rapidapi.com");
    return textResponse(JSON.stringify({
      result: [
        {
          videoId: "FGBhQbmPwH8",
          title: "One More Time",
          artists: [{ name: "Daft Punk" }],
          album: { name: "Discovery" },
          duration: "5:20"
        }
      ]
    }));
  }, async () => {
    try {
      const result = await __testHooks.enrichWithRapidApiYoutubeMusicMatch({
        title: "One More Time",
        description: "Daft Punk",
        album: "Discovery",
        durationMs: 320000,
        links: []
      });

      assert.equal(result.links.find(link => link.type === "youtube")?.url, "https://www.youtube.com/watch?v=FGBhQbmPwH8");
      assert.equal(result.links.find(link => link.type === "youtubeMusic")?.url, "https://music.youtube.com/watch?v=FGBhQbmPwH8");
      assert.equal(result.links.find(link => link.type === "youtube")?.source, "rapidapi_youtube_music_api3");
    } finally {
      restoreEnv("RAPIDAPI_FALLBACKS_ENABLED", previousEnabled);
      restoreEnv("RAPIDAPI_KEY", previousKey);
      restoreEnv("RAPIDAPI_YOUTUBE_MUSIC_ENABLED", previousYoutubeMusic);
      __resetRapidApiQuotaForTests();
    }
  });
});

test("Deezer input context reads track metadata and canonical key from Deezer API", async () => {
  const previousDeezer = process.env.DEEZER_MATCHING_ENABLED;
  process.env.DEEZER_MATCHING_ENABLED = "true";

  await withMockFetch(async input => {
    const url = String(input);
    if (url === "https://api.deezer.com/track/3135553") {
      return jsonResponse(buildDeezerTrack({
        id: 3135553,
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery",
        isrc: "GBDUW0000053"
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    try {
      const context = await __testHooks.buildInputCacheContext(
        "https://www.deezer.com/br/track/3135553?utm_source=test",
        "deezer"
      );

      assert.equal(context.title, "One More Time");
      assert.equal(context.artist, "Daft Punk");
      assert.equal(context.album, "Discovery");
      assert.equal(context.isrc, "GBDUW0000053");
      assert.equal(context.canonicalKey, "isrc:gbduw0000053");
    } finally {
      restoreEnv("DEEZER_MATCHING_ENABLED", previousDeezer);
    }
  });
});

test("Deezer matching adds a verified direct Deezer track link", async () => {
  const previousDeezer = process.env.DEEZER_MATCHING_ENABLED;
  process.env.DEEZER_MATCHING_ENABLED = "true";

  await withMockFetch(async input => {
    const url = String(input);
    if (url.startsWith("https://api.deezer.com/search/track")) {
      return jsonResponse({
        total: 1,
        data: [
          buildDeezerTrack({
            id: 3135553,
            title: "One More Time",
            artist: "Daft Punk",
            album: "Discovery",
            duration: 320,
            isrc: "GBDUW0000053"
          })
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    try {
      const result = await __testHooks.enrichWithDeezerMatch({
        title: "One More Time",
        description: "Daft Punk",
        links: [
          {
            type: "spotify",
            url: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV",
            isVerified: true,
            source: "input"
          }
        ]
      });

      const deezer = result.links.find(link => link.type === "deezer");
      assert.ok(deezer);
      assert.equal(deezer.url, "https://www.deezer.com/track/3135553");
      assert.equal(deezer.source, "deezer_api");
      assert.equal(deezer.isVerified, true);
    } finally {
      restoreEnv("DEEZER_MATCHING_ENABLED", previousDeezer);
    }
  });
});

test("POST /api/convert preserves Deezer input link with Deezer metadata", async () => {
  const previousDeezer = process.env.DEEZER_MATCHING_ENABLED;
  process.env.DEEZER_MATCHING_ENABLED = "true";

  await withMockFetch(async input => {
    const url = String(input);
    if (url === "https://api.deezer.com/track/3135553") {
      return jsonResponse(buildDeezerTrack({
        id: 3135553,
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery",
        isrc: "GBDUW0000053"
      }));
    }
    if (url === "https://idonthavespotify.sjdonado.com/api/search?v=1") {
      return textResponse(JSON.stringify({ error: "upstream unavailable" }), { ok: false, status: 502 });
    }
    if (url.startsWith("https://api.song.link/v1-alpha.1/links")) {
      return jsonResponse({ error: "songlink unavailable" }, { ok: false, status: 502 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    try {
      const response = await callConvertApi({
        body: {
          link: "https://www.deezer.com/br/track/3135553?utm_source=test",
          adapters: ["deezer"]
        }
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.data.title, "One More Time");
      assert.equal(response.body.data.description, "Daft Punk");
      assert.equal(response.body.data.links[0].type, "deezer");
      assert.equal(response.body.data.links[0].url, "https://www.deezer.com/track/3135553");
      assert.equal(response.body.data.links[0].source, "input");
    } finally {
      restoreEnv("DEEZER_MATCHING_ENABLED", previousDeezer);
    }
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
      deezer: { url: "https://www.deezer.com/track/3135553" },
      youtube: { url: "https://www.youtube.com/watch?v=FGBhQbmPwH8" },
      youtubeMusic: { url: "https://music.youtube.com/watch?v=FGBhQbmPwH8" },
      amazonMusic: { url: "https://music.amazon.com/albums/example" },
      pandora: { url: "https://www.pandora.com/song/example" },
      tidal: { url: "https://tidal.com/browse/track/75413016" }
    }
  }, { markVerified: true });

  assert.deepEqual(
    normalized.links.map(link => link.type).sort(),
    ["appleMusic", "deezer", "spotify", "youtube", "youtubeMusic"].sort()
  );
});

test("Songlink enrichment fills Deezer and ignores paused TIDAL links", async () => {
  const appleUrl = "https://music.apple.com/us/album/golden/1820264137?i=1820264150&uo=4";
  await withMockFetch(async input => {
    const url = String(input);
    assert.ok(url.startsWith("https://api.song.link/v1-alpha.1/links?url="));
    return jsonResponse({
      entityUniqueId: "ITUNES_SONG::1820264150",
      entitiesByUniqueId: {
        "ITUNES_SONG::1820264150": {
          title: "Golden",
          artistName: "HUNTR/X",
          albumName: "KPop Demon Hunters (Soundtrack from the Netflix Film)"
        }
      },
      linksByPlatform: {
        appleMusic: { url: appleUrl },
        deezer: { url: "https://www.deezer.com/track/3412534581" },
        tidal: { url: "https://listen.tidal.com/track/441821360" }
      }
    });
  }, async () => {
    const result = await __testHooks.enrichWithSongLinkDirectLinks({
      title: "Golden",
      description: "HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast",
      links: [
        {
          type: "appleMusic",
          url: appleUrl,
          isVerified: true,
          source: "input"
        }
      ]
    });

    assert.equal(result.links.find(link => link.type === "deezer")?.url, "https://www.deezer.com/track/3412534581");
    assert.equal(result.links.some(link => link.type === "tidal"), false);
  });
});

async function callConvertApi({ method = "POST", body = {}, url = "/api/convert" } = {}) {
  const req = {
    method,
    body,
    url,
    headers: {
      "user-agent": "node-test"
    },
    socket: {
      remoteAddress: `127.0.0.${Math.floor(Math.random() * 200) + 1}`
    }
  };
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };

  await convertHandler(req, res);
  return res;
}

async function withMockFetch(fetchImpl, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
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

function buildDeezerTrack({
  id,
  title,
  artist,
  album = "",
  duration = 320,
  isrc = "",
  readable = true,
  rank = 500000
}) {
  return {
    id,
    title,
    title_short: title,
    link: `https://www.deezer.com/track/${id}`,
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
