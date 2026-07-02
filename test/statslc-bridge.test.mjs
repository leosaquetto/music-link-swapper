import test from "node:test";
import assert from "node:assert/strict";

import {
  isStatslcBridgeConfigured,
  searchStatslcBridge
} from "../server/lib/statslc-bridge.js";

test("stats-lc bridge provider calls configured backend with bearer token", async () => {
  const previousEnabled = process.env.STATSLC_BRIDGE_ENABLED;
  const previousUrl = process.env.STATSLC_BRIDGE_URL;
  const previousToken = process.env.STATSLC_BRIDGE_TOKEN;
  const originalFetch = globalThis.fetch;
  let capturedUrl = null;
  let capturedAuth = "";

  process.env.STATSLC_BRIDGE_ENABLED = "true";
  process.env.STATSLC_BRIDGE_URL = "https://statslc.example.test/api/catalog-link-bridge";
  process.env.STATSLC_BRIDGE_TOKEN = "bridge-token";

  globalThis.fetch = async (input, init = {}) => {
    capturedUrl = new URL(String(input));
    capturedAuth = init?.headers?.Authorization || "";
    return new Response(JSON.stringify({
      ok: true,
      matched: true,
      score: 98,
      track: {
        title: "Venice Bitch",
        artist: "Lana Del Rey",
        durationMs: 577199
      },
      links: [
        {
          type: "spotify",
          id: "3hwQhakFwm9soLEBnSDH17",
          url: "https://open.spotify.com/track/3hwQhakFwm9soLEBnSDH17",
          isVerified: true
        },
        {
          type: "appleMusic",
          id: "1474669067",
          url: "https://music.apple.com/song/1474669067",
          isVerified: true
        }
      ]
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    assert.equal(isStatslcBridgeConfigured(), true);
    const match = await searchStatslcBridge({
      query: "Lana Del Rey Venice Bitch",
      title: "Venice Bitch",
      artist: "Lana Del Rey",
      spotifyId: "3hwQhakFwm9soLEBnSDH17",
      durationMs: 577199
    });

    assert.equal(capturedUrl.searchParams.get("spotifyId"), "3hwQhakFwm9soLEBnSDH17");
    assert.equal(capturedUrl.searchParams.get("title"), "Venice Bitch");
    assert.equal(capturedAuth, "Bearer bridge-token");
    assert.equal(match.score, 98);
    assert.deepEqual(match.links.map(link => link.source), ["statslc_bridge", "statslc_bridge"]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("STATSLC_BRIDGE_ENABLED", previousEnabled);
    restoreEnv("STATSLC_BRIDGE_URL", previousUrl);
    restoreEnv("STATSLC_BRIDGE_TOKEN", previousToken);
  }
});

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
