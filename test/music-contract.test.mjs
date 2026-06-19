import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalTrackKey,
  decorateResultForResponse,
  filterDisplayLinks,
  getMissingPlatforms,
  validatePlatformUrl
} from "../api/lib/music-contract.js";
import { scoreSpotifyCandidate } from "../api/lib/spotify-web.js";

test("filterDisplayLinks keeps only direct automatic platform links", () => {
  const links = filterDisplayLinks([
    { type: "spotify", url: "https://open.spotify.com/track/123?si=abc", isVerified: true },
    { type: "spotify", url: "https://open.spotify.com/search/daft%20punk" },
    { type: "appleMusic", url: "https://music.apple.com/br/album/example/111?i=222&l=en-US" },
    { type: "youtubeMusic", url: "https://music.youtube.com/search?q=daft+punk" },
    { type: "youtube", url: "https://www.youtube.com/watch?v=abc123" },
    { type: "deezer", url: "https://www.deezer.com/track/1" },
    { type: "spotify", url: "https://open.spotify.com/track/123", notAvailable: true }
  ]);

  assert.deepEqual(
    links.map(item => item.type),
    ["spotify", "appleMusic", "deezer", "youtube", "youtubeMusic"]
  );
  assert.equal(links[0].url, "https://open.spotify.com/track/123");
  assert.equal(links.find(item => item.type === "youtubeMusic").url, "https://music.youtube.com/watch?v=abc123");
  assert.equal(links.some(item => item.url.includes("/search")), false);
});

test("decorateResultForResponse adds cache metadata and missing platforms", () => {
  const result = decorateResultForResponse(
    {
      title: "One More Time",
      description: "Daft Punk",
      links: [
        { type: "spotify", url: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV", source: "input" },
        { type: "youtubeMusic", url: "https://music.youtube.com/search?q=one+more+time", source: "generated" }
      ]
    },
    { cacheStatus: "hit" }
  );

  assert.match(result.trackId, /^trk_[a-f0-9]{20}$/);
  assert.equal(result.cacheStatus, "partial");
  assert.deepEqual(result.links.map(item => item.type), ["spotify"]);
  assert.deepEqual(result.missingPlatforms, ["appleMusic", "deezer", "youtube", "youtubeMusic"]);
});

test("validatePlatformUrl rejects search URLs and platform mismatches", () => {
  assert.equal(validatePlatformUrl("spotify", "https://open.spotify.com/track/abc").ok, true);
  assert.equal(validatePlatformUrl("spotify", "https://open.spotify.com/search/abc").ok, false);
  assert.equal(validatePlatformUrl("deezer", "https://www.deezer.com/track/3135553").ok, true);
  assert.equal(validatePlatformUrl("deezer", "https://www.deezer.com/search/daft%20punk").ok, false);
  assert.equal(validatePlatformUrl("youtubeMusic", "https://www.youtube.com/watch?v=abc").ok, false);
  assert.equal(validatePlatformUrl("appleMusic", "https://music.apple.com/br/album/a/1?i=2").ok, true);
});

test("buildCanonicalTrackKey normalizes accents and prefers ISRC", () => {
  assert.equal(
    buildCanonicalTrackKey({ title: "Construção", artist: "Chico Buarque" }),
    "track:construcao|artist:chico buarque"
  );
  assert.equal(buildCanonicalTrackKey({ title: "x", artist: "y", isrc: "BR-ABC-12-00001" }), "isrc:br abc 12 00001");
});

test("scoreSpotifyCandidate favors exact title and artist over live/remix drift", () => {
  const target = { title: "One More Time", artist: "Daft Punk", query: "Daft Punk One More Time" };
  const exact = scoreSpotifyCandidate(target, { title: "One More Time", artist: "Daft Punk" });
  const live = scoreSpotifyCandidate(target, { title: "One More Time - Live", artist: "Daft Punk Tribute Band" });

  assert.ok(exact > live);
  assert.ok(exact >= 80);
});

test("getMissingPlatforms reports the current automatic platform set", () => {
  assert.deepEqual(
    getMissingPlatforms([
      { type: "spotify", url: "https://open.spotify.com/track/abc" },
      { type: "deezer", url: "https://www.deezer.com/track/1" },
      { type: "youtube", url: "https://www.youtube.com/watch?v=abc" }
    ]),
    ["appleMusic"]
  );
});
