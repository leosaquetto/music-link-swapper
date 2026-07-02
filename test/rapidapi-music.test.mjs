import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetRapidApiQuotaForTests,
  fetchRapidApiMusicDataYoutubeVideo,
  isRapidApiFallbackEnabled,
  searchRapidApiShazamTrack,
  searchRapidApiSpotifyTrack,
  searchRapidApiSpotifyWebApi3Track,
  searchRapidApiYoutubeMusicTrack
} from "../server/lib/rapidapi-music.js";

test("RapidAPI fallbacks stay disabled unless explicitly enabled with a key", async () => {
  await withRapidApiEnv({ enabled: "", key: "" }, async () => {
    assert.equal(isRapidApiFallbackEnabled(), false);
    assert.equal(await searchRapidApiSpotifyTrack({ query: "Daft Punk One More Time" }), null);
  });
});

test("RapidAPI Spotify23 search returns a scored direct Spotify track link", async () => {
  await withRapidApiEnv({ enabled: "true", key: "test-rapidapi-key" }, async () => {
    await withMockFetch(async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, "spotify23.p.rapidapi.com");
      assert.equal(url.pathname, "/search/");
      assert.equal(url.searchParams.get("type"), "tracks");
      assert.equal(url.searchParams.get("gl"), "US");
      assert.equal(options.headers["x-rapidapi-host"], "spotify23.p.rapidapi.com");
      assert.equal(options.headers["x-rapidapi-key"], "test-rapidapi-key");

      return jsonResponse({
        tracks: {
          items: [
            {
              data: {
                id: "0DiWol3AO6WpXZgp0goxAV",
                uri: "spotify:track:0DiWol3AO6WpXZgp0goxAV",
                name: "One More Time",
                artists: {
                  items: [{ profile: { name: "Daft Punk" } }]
                },
                albumOfTrack: {
                  name: "Discovery",
                  coverArt: { sources: [{ url: "https://example.com/cover.jpg" }] }
                },
                duration: { totalMilliseconds: 320000 }
              }
            }
          ]
        }
      });
    }, async () => {
      const match = await searchRapidApiSpotifyTrack({
        query: "Daft Punk One More Time",
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery",
        durationMs: 320000,
        countryCode: "US"
      });

      assert.equal(match.type, "spotify");
      assert.equal(match.url, "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV");
      assert.equal(match.source, "rapidapi_spotify23");
      assert.equal(match.isVerified, true);
    });
  });
});

test("RapidAPI Spotify Web API3 search returns a scored direct Spotify track link", async () => {
  await withRapidApiEnv({ enabled: "true", key: "test-rapidapi-key" }, async () => {
    await withMockFetch(async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, "spotify-web-api3.p.rapidapi.com");
      assert.equal(url.pathname, "/v1/social/spotify/searchtracks");
      assert.equal(options.method, "POST");
      assert.equal(options.headers["x-rapidapi-host"], "spotify-web-api3.p.rapidapi.com");
      assert.deepEqual(JSON.parse(options.body), {
        terms: "The Kill Thirty Seconds To Mars",
        limit: 10
      });

      return jsonResponse({
        tracks: [
          {
            track: "The Kill",
            link: "https://open.spotify.com/track/4rRNDclay9ayn1iR1VpMMB",
            artist: "Thirty Seconds To Mars"
          }
        ]
      });
    }, async () => {
      const match = await searchRapidApiSpotifyWebApi3Track({
        query: "The Kill Thirty Seconds To Mars",
        title: "The Kill",
        artist: "Thirty Seconds To Mars"
      });

      assert.equal(match.type, "spotify");
      assert.equal(match.url, "https://open.spotify.com/track/4rRNDclay9ayn1iR1VpMMB");
      assert.equal(match.source, "rapidapi_spotify_web_api3");
      assert.equal(match.isVerified, true);
    });
  });
});

test("RapidAPI Shazam search returns Apple Music direct link and ignores provider search deeplinks", async () => {
  await withRapidApiEnv({ enabled: "true", key: "test-rapidapi-key" }, async () => {
    await withMockFetch(async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, "shazam.p.rapidapi.com");
      assert.equal(url.pathname, "/v2/search");
      assert.equal(url.searchParams.get("term"), "Kiss The Rain Billie Myers");
      assert.equal(url.searchParams.get("locale"), "fr-FR");
      assert.equal(options.headers["x-rapidapi-host"], "shazam.p.rapidapi.com");

      return jsonResponse({
        tracks: {
          hits: [
            {
              track: {
                key: "20066955",
                title: "Kiss The Rain",
                subtitle: "Billie Myers",
                share: {
                  href: "https://www.shazam.com/track/20066955/kiss-the-rain",
                  image: "https://example.com/cover.jpg"
                },
                hub: {
                  actions: [
                    { type: "applemusicplay", id: "1444027955" }
                  ],
                  options: [
                    {
                      actions: [
                        {
                          type: "applemusicopen",
                          uri: "https://music.apple.com/us/album/kiss-the-rain/1444027943?i=1444027955&mttnagencyid=s2n&app=music"
                        }
                      ]
                    }
                  ],
                  providers: [
                    {
                      type: "SPOTIFY",
                      actions: [
                        { type: "uri", uri: "spotify:search:Kiss%20The%20Rain%20Billie%20Myers" }
                      ]
                    }
                  ]
                }
              }
            }
          ]
        }
      });
    }, async () => {
      const match = await searchRapidApiShazamTrack({
        query: "Kiss The Rain Billie Myers",
        title: "Kiss The Rain",
        artist: "Billie Myers",
        locale: "fr-FR"
      });

      assert.equal(match.type, "shazam");
      assert.equal(match.source, "rapidapi_shazam");
      assert.equal(match.appleMusicTrackId, "1444027955");
      assert.equal(match.appleMusicUrl, "https://music.apple.com/us/album/kiss-the-rain/1444027943?i=1444027955");
      assert.equal(match.isVerified, true);
    });
  });
});

test("RapidAPI MusicData reads YouTube video metadata from a video id", async () => {
  await withRapidApiEnv({ enabled: "true", key: "test-rapidapi-key" }, async () => {
    await withMockFetch(async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, "musicdata-api.p.rapidapi.com");
      assert.equal(url.pathname, "/youtube/video/ZtdcRMgAU0A");
      assert.equal(options.headers["x-rapidapi-host"], "musicdata-api.p.rapidapi.com");

      return jsonResponse([
        {
          track: "Avril Lavigne - Keep Holding On (Official Lyric Video)",
          link: "https://www.youtube.com/watch/ZtdcRMgAU0A"
        }
      ]);
    }, async () => {
      const metadata = await fetchRapidApiMusicDataYoutubeVideo("ZtdcRMgAU0A");

      assert.equal(metadata.source, "rapidapi_musicdata");
      assert.equal(metadata.artist, "Avril Lavigne");
      assert.equal(metadata.title, "Keep Holding On");
      assert.equal(metadata.videoId, "ZtdcRMgAU0A");
    });
  });
});

test("RapidAPI YouTube Music API3 search returns paired YouTube links", async () => {
  await withRapidApiEnv({ enabled: "true", key: "test-rapidapi-key" }, async () => {
    await withMockFetch(async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, "youtube-music-api3.p.rapidapi.com");
      assert.equal(url.pathname, "/search");
      assert.equal(url.searchParams.get("type"), "song");
      assert.equal(options.headers["x-rapidapi-host"], "youtube-music-api3.p.rapidapi.com");

      return jsonResponse({
        result: [
          {
            videoId: "FGBhQbmPwH8",
            title: "One More Time",
            artists: [{ name: "Daft Punk" }],
            album: { name: "Discovery" },
            duration: "5:20"
          }
        ]
      });
    }, async () => {
      const match = await searchRapidApiYoutubeMusicTrack({
        query: "Daft Punk One More Time",
        title: "One More Time",
        artist: "Daft Punk",
        album: "Discovery",
        durationMs: 320000
      });

      assert.equal(match.type, "youtubeMusic");
      assert.equal(match.videoId, "FGBhQbmPwH8");
      assert.equal(match.url, "https://music.youtube.com/watch?v=FGBhQbmPwH8");
      assert.equal(match.source, "rapidapi_youtube_music_api3");
      assert.deepEqual(
        match.links.map(link => link.type),
        ["youtube", "youtubeMusic"]
      );
    });
  });
});

test("RapidAPI local daily quota prevents accidental overuse", async () => {
  await withRapidApiEnv({ enabled: "true", key: "test-rapidapi-key", dailyLimit: "1" }, async () => {
    await withMockFetch(async () => jsonResponse({ tracks: { items: [] } }), async () => {
      await searchRapidApiSpotifyTrack({ query: "Daft Punk One More Time", title: "One More Time", artist: "Daft Punk" });
      await assert.rejects(
        () => searchRapidApiSpotifyTrack({ query: "Daft Punk One More Time", title: "One More Time", artist: "Daft Punk" }),
        /rapidapi local daily quota exceeded/
      );
    });
  });
});

async function withRapidApiEnv({ enabled, key, dailyLimit = "" }, run) {
  const previousEnabled = process.env.RAPIDAPI_FALLBACKS_ENABLED;
  const previousKey = process.env.RAPIDAPI_KEY;
  const previousLimit = process.env.RAPIDAPI_DAILY_REQUEST_LIMIT;
  const previousSpotify = process.env.RAPIDAPI_SPOTIFY_ENABLED;
  const previousSpotifyWebApi3 = process.env.RAPIDAPI_SPOTIFY_WEB_API3_ENABLED;
  const previousShazam = process.env.RAPIDAPI_SHAZAM_ENABLED;
  const previousShazamLocale = process.env.RAPIDAPI_SHAZAM_LOCALE;
  const previousMusicData = process.env.RAPIDAPI_MUSICDATA_ENABLED;
  const previousYoutubeMusic = process.env.RAPIDAPI_YOUTUBE_MUSIC_ENABLED;
  process.env.RAPIDAPI_FALLBACKS_ENABLED = enabled;
  process.env.RAPIDAPI_KEY = key;
  process.env.RAPIDAPI_DAILY_REQUEST_LIMIT = dailyLimit;
  process.env.RAPIDAPI_SPOTIFY_ENABLED = "true";
  process.env.RAPIDAPI_SPOTIFY_WEB_API3_ENABLED = "true";
  process.env.RAPIDAPI_SHAZAM_ENABLED = "true";
  process.env.RAPIDAPI_SHAZAM_LOCALE = "en-US";
  process.env.RAPIDAPI_MUSICDATA_ENABLED = "true";
  process.env.RAPIDAPI_YOUTUBE_MUSIC_ENABLED = "true";
  __resetRapidApiQuotaForTests();
  try {
    await run();
  } finally {
    restoreEnv("RAPIDAPI_FALLBACKS_ENABLED", previousEnabled);
    restoreEnv("RAPIDAPI_KEY", previousKey);
    restoreEnv("RAPIDAPI_DAILY_REQUEST_LIMIT", previousLimit);
    restoreEnv("RAPIDAPI_SPOTIFY_ENABLED", previousSpotify);
    restoreEnv("RAPIDAPI_SPOTIFY_WEB_API3_ENABLED", previousSpotifyWebApi3);
    restoreEnv("RAPIDAPI_SHAZAM_ENABLED", previousShazam);
    restoreEnv("RAPIDAPI_SHAZAM_LOCALE", previousShazamLocale);
    restoreEnv("RAPIDAPI_MUSICDATA_ENABLED", previousMusicData);
    restoreEnv("RAPIDAPI_YOUTUBE_MUSIC_ENABLED", previousYoutubeMusic);
    __resetRapidApiQuotaForTests();
  }
}

async function withMockFetch(fetchImpl, run) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(payload)
  };
}

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
