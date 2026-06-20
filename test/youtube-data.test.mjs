import test from "node:test";
import assert from "node:assert/strict";

import { buildYoutubePlatformLinks } from "../api/lib/music-contract.js";
import {
  scoreYoutubeCandidate,
  searchYoutubeVideoForTrackWithDiagnostics
} from "../api/lib/youtube-data.js";

test("buildYoutubePlatformLinks mirrors one trusted video id across YouTube surfaces", () => {
  const links = buildYoutubePlatformLinks("V2G8ESoDXm8", {
    source: "youtube_api",
    isVerified: true
  });

  assert.deepEqual(links, [
    {
      type: "youtube",
      url: "https://www.youtube.com/watch?v=V2G8ESoDXm8",
      isVerified: true,
      source: "youtube_api"
    },
    {
      type: "youtubeMusic",
      url: "https://music.youtube.com/watch?v=V2G8ESoDXm8",
      isVerified: true,
      source: "youtube_api"
    }
  ]);
});

test("scoreYoutubeCandidate prefers official audio over unrelated or cover videos", () => {
  const target = {
    title: "Saturn",
    artist: "SZA",
    durationMs: 186000
  };

  const officialAudio = scoreYoutubeCandidate(target, {
    title: "SZA - Saturn (Official Audio)",
    channelTitle: "SZA",
    description: "Provided to YouTube by Top Dawg Entertainment",
    categoryId: "10",
    durationMs: 185000,
    licensedContent: true,
    liveBroadcastContent: "none",
    position: 0
  });
  const cover = scoreYoutubeCandidate(target, {
    title: "Saturn - SZA cover karaoke",
    channelTitle: "Bedroom Covers",
    description: "cover version",
    categoryId: "10",
    durationMs: 205000,
    licensedContent: false,
    liveBroadcastContent: "none",
    position: 0
  });

  assert.ok(officialAudio >= 84);
  assert.ok(officialAudio > cover);
});

test("YouTube data matching accepts a strict official audio candidate first", async () => {
  const searchUrls = [];

  await withYoutubeMockFetch(async url => {
    if (url.includes("/search")) {
      searchUrls.push(url);
      return jsonResponse({
        items: [
          buildSearchItem("strict123", "SZA - Saturn (Official Audio)", "SZA")
        ]
      });
    }
    if (url.includes("/videos")) {
      return jsonResponse({
        items: [
          buildVideoDetail("strict123", {
            title: "SZA - Saturn (Official Audio)",
            channelTitle: "SZA",
            description: "Provided to YouTube by Top Dawg Entertainment",
            duration: "PT3M6S"
          })
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const result = await searchYoutubeVideoForTrackWithDiagnostics("SZA Saturn", {
      title: "Saturn",
      artist: "SZA",
      durationMs: 186000,
      countryCode: "ES",
      locale: "es-ES"
    });

    assert.equal(result.match.videoId, "strict123");
    assert.equal(result.match.pass, "strict");
    assert.equal(searchUrls.length, 1);
    const strictUrl = new URL(searchUrls[0]);
    assert.equal(strictUrl.searchParams.get("videoCategoryId"), "10");
    assert.equal(strictUrl.searchParams.get("regionCode"), "ES");
    assert.equal(strictUrl.searchParams.get("relevanceLanguage"), "es");
    assert.match(strictUrl.searchParams.get("q"), /official audio/i);
  });
});

test("YouTube data matching uses a broad second pass after strict no_match", async () => {
  const searchUrls = [];

  await withYoutubeMockFetch(async url => {
    if (url.includes("/search")) {
      searchUrls.push(url);
      if (searchUrls.length === 1) return jsonResponse({ items: [] });
      return jsonResponse({
        items: [
          buildSearchItem("broad123", "50landing - i could have sworn", "50landing")
        ]
      });
    }
    if (url.includes("/videos")) {
      return jsonResponse({
        items: [
          buildVideoDetail("broad123", {
            title: "50landing - i could have sworn",
            channelTitle: "50landing",
            description: "Official audio",
            duration: "PT5M26S",
            categoryId: "22"
          })
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const result = await searchYoutubeVideoForTrackWithDiagnostics("50landing i could have sworn", {
      title: "i could have sworn",
      artist: "50landing",
      durationMs: 326000
    });

    assert.equal(result.match.videoId, "broad123");
    assert.equal(result.match.pass, "broad");
    assert.equal(searchUrls.length, 2);

    const broadUrl = new URL(searchUrls[1]);
    assert.equal(broadUrl.searchParams.has("videoCategoryId"), false);
    assert.equal(broadUrl.searchParams.get("maxResults"), "10");
    assert.equal(broadUrl.searchParams.get("q"), "50landing i could have sworn");
  });
});

test("YouTube data matching rejects broad candidates with mismatched duration", async () => {
  await withYoutubeMockFetch(async url => {
    if (url.includes("/search")) {
      const parsed = new URL(url);
      if (parsed.searchParams.has("videoCategoryId")) return jsonResponse({ items: [] });
      return jsonResponse({
        items: [
          buildSearchItem("wrongduration", "50landing - i could have sworn", "50landing")
        ]
      });
    }
    if (url.includes("/videos")) {
      return jsonResponse({
        items: [
          buildVideoDetail("wrongduration", {
            title: "50landing - i could have sworn",
            channelTitle: "50landing",
            description: "Official audio",
            duration: "PT2M0S",
            categoryId: "22"
          })
        ]
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }, async () => {
    const result = await searchYoutubeVideoForTrackWithDiagnostics("50landing i could have sworn", {
      title: "i could have sworn",
      artist: "50landing",
      durationMs: 326000
    });

    assert.equal(result.match, null);
    assert.equal(result.diagnostics.lastPass, "broad");
    assert.ok(result.diagnostics.broad.bestScore >= 84);
  });
});

async function withYoutubeMockFetch(fetchImpl, run) {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.YOUTUBE_API_KEY;
  const previousEnabled = process.env.YOUTUBE_MATCHING_ENABLED;
  process.env.YOUTUBE_API_KEY = "test-youtube-key";
  process.env.YOUTUBE_MATCHING_ENABLED = "true";
  globalThis.fetch = fetchImpl;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("YOUTUBE_API_KEY", previousKey);
    restoreEnv("YOUTUBE_MATCHING_ENABLED", previousEnabled);
  }
}

function buildSearchItem(videoId, title, channelTitle) {
  return {
    id: { videoId },
    snippet: {
      title,
      channelTitle,
      description: "",
      liveBroadcastContent: "none"
    }
  };
}

function buildVideoDetail(videoId, overrides = {}) {
  return {
    id: videoId,
    snippet: {
      title: overrides.title || "",
      channelTitle: overrides.channelTitle || "",
      description: overrides.description || "",
      categoryId: overrides.categoryId || "10",
      liveBroadcastContent: "none"
    },
    contentDetails: {
      duration: overrides.duration || "PT3M0S",
      licensedContent: true
    }
  };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body
  };
}

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
