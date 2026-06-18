# Link matching and cache strategy

The product follows a Tapelink-style regular link promise for v1:

- Automatic links are limited to Spotify, Apple Music, YouTube, and YouTube Music.
- Result cards render only direct, openable links.
- Generated search URLs are never valid display links.
- Missing platforms are exposed only as `missingPlatforms` for correction prompts, not as failed rows.

## Provider order

`POST /api/convert` checks cheap and trusted sources before expensive or fragile lookups:

1. Postgres/Neon cache by normalized input URL.
2. Postgres/Neon cache by canonical track key.
3. Direct input link preservation when the submitted URL is already a valid platform link.
4. stats-lc bridge for Spotify and Apple Music enrichment from stats.fm catalog IDs.
5. Spotify Web Player matching when enabled.
6. Apple Music/iTunes lookup and search.
7. Songlink/Odesli enrichment for direct links returned by that provider.
8. YouTube Data API matching only when still missing YouTube or YouTube Music.
9. Manual correction, hidden unless a primary platform is missing.

Songlink/Odesli is intentionally before the YouTube Data API. If it returns a direct YouTube, YouTube Music, Apple Music, or Spotify link, the app can persist that result without spending YouTube API quota. If it returns only unrelated platforms or the same input platform, the app skips those links.

## Persistent library

When `DATABASE_URL` is configured, the API persists a shared music library:

- `tracks`: canonical track metadata and keys.
- `track_links`: direct platform links only.
- `track_aliases`: normalized input URLs and alternate keys.
- `provider_attempts`: provider hit/miss telemetry.

When `DATABASE_URL` is absent, conversion still works, but durable cache and provider attempt storage are disabled. Local development can use `pglite://.data/music-link-swapper`; production should use Neon/Postgres.

## API response contract

`data.links` contains only direct usable links. Each link includes a `source` such as:

- `input`
- `cache`
- `spotify_web`
- `itunes`
- `songlink`
- `idhs`
- `youtube_api`
- `statslc_bridge`
- `manual`

The API also returns:

- `data.trackId`: the durable local track id when available.
- `data.cacheStatus`: `hit`, `miss`, or `partial`.
- `data.missingPlatforms`: supported automatic platforms that are still missing, for correction UI only.

Search URLs such as `open.spotify.com/search/...` or `music.youtube.com/search?...` must not be returned as result links.

## YouTube and YouTube Music

YouTube and YouTube Music can appear automatically only when the app has a trusted direct video ID from:

- input URL;
- cache;
- Songlink/Odesli or another trusted provider;
- YouTube Data API;
- accepted manual correction.

When one trusted YouTube video ID exists, the app mirrors it across both YouTube surfaces:

- `https://www.youtube.com/watch?v=<id>`
- `https://music.youtube.com/watch?v=<id>`

The API key is optional. Set `YOUTUBE_MATCHING_ENABLED=false` to disable the YouTube Data API path instantly.

## stats-lc bridge

The swapper can call `stats-lc-api` at `/api/catalog-link-bridge` to enrich Spotify and Apple Music IDs from stats.fm catalog data. Production should set:

- `STATSLC_BRIDGE_ENABLED=true`
- `STATSLC_BRIDGE_URL=https://statslc.leosaquetto.com/api/catalog-link-bridge`
- `STATSLC_BRIDGE_TOKEN=<same value as CATALOG_LINK_BRIDGE_TOKEN>`

The bridge is opportunistic. It should improve cache quality when stats.fm exposes useful external IDs, but the swapper must continue working if the bridge misses or is disabled.

## Manual correction

Manual corrections go through `POST /api/manual-link` with:

- `trackId`
- `platform`
- `url`
- `correctionToken`

The API validates the host/platform and stores low-confidence corrections as hidden/pending instead of polluting the shared cache.

## Regression checklist

Before deploying matching changes:

- Run `npm run check`.
- Run `npm run check:env`.
- Confirm `POST /api/convert` returns no `/search` URLs.
- Confirm `data.links` has no `notAvailable` display rows.
- Test at least one Spotify input, one Apple Music input, and one YouTube input.
- Check Vercel runtime logs for error/fatal logs after production smoke tests.
