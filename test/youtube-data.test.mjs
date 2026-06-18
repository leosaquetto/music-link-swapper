import test from "node:test";
import assert from "node:assert/strict";

import { buildYoutubePlatformLinks } from "../api/lib/music-contract.js";
import { scoreYoutubeCandidate } from "../api/lib/youtube-data.js";

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
