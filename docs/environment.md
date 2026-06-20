# Environment setup

This app works without paid services. Persistent cache needs a Postgres-compatible URL.

For the current provider order, direct-link-only contract, and cache rules, see
[`docs/link-matching.md`](./link-matching.md).

For security, abuse controls, quota monitoring, and secret handling, see
[`docs/security.md`](./security.md).

## Local zero-cost cache

For local development, use PGlite:

```bash
DATABASE_URL="pglite://.data/music-link-swapper"
```

This creates an embedded Postgres-compatible database under `.data/`. It is durable on your machine and costs nothing.

## Production shared cache

Set `DATABASE_URL` to a Postgres/Neon connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require"
```

Free setup path with Neon CLI:

1. Run `npx neonctl auth` and complete the browser login.
2. Run `npm run setup:neon`.
3. Run:

```bash
npm run check:env
npm run check
```

`npm run setup:neon` creates a Neon project using the free-tier-compatible defaults, fetches a pooled connection string, and writes `DATABASE_URL` to `.env.local`.

Manual setup is also fine: create a free Neon Postgres database, copy the pooled connection string, and add it to `.env.local` for local development or to Vercel environment variables for production.

When `DATABASE_URL` is absent, the API still converts links, but `tracks`, `track_links`, `track_aliases`, and `provider_attempts` are not persisted.

When `DATABASE_URL` starts with `pglite://`, the cache is local to that filesystem. Use Neon/Postgres for a shared production library.

## Optional variables

```bash
SPOTIFY_WEB_MATCHING_ENABLED="true"
STATSLC_BRIDGE_ENABLED="true"
STATSLC_BRIDGE_URL="https://statslc.leosaquetto.com/api/catalog-link-bridge"
STATSLC_BRIDGE_TOKEN=""
YOUTUBE_MATCHING_ENABLED="true"
DEEZER_MATCHING_ENABLED="true"
RAPIDAPI_FALLBACKS_ENABLED="false"
RAPIDAPI_KEY=""
RAPIDAPI_SPOTIFY_ENABLED="true"
RAPIDAPI_SPOTIFY_WEB_API3_ENABLED="true"
RAPIDAPI_SHAZAM_ENABLED="true"
RAPIDAPI_SHAZAM_LOCALE="en-US"
RAPIDAPI_MUSICDATA_ENABLED="true"
RAPIDAPI_YOUTUBE_MUSIC_ENABLED="true"
RAPIDAPI_DAILY_REQUEST_LIMIT="8"
RAPIDAPI_COUNTRY_CODE="BR"
MANUAL_LINK_TOKEN=""
YOUTUBE_API_KEY=""
```

- `SPOTIFY_WEB_MATCHING_ENABLED=false` disables Spotify Web Player matching instantly.
- `STATSLC_BRIDGE_ENABLED=false` disables the internal stats-lc/stats.fm catalog bridge instantly.
- `STATSLC_BRIDGE_URL` points to the stats-lc API bridge used to enrich Spotify and Apple Music IDs before text-search fallbacks.
- `STATSLC_BRIDGE_TOKEN` is optional locally, but should match `CATALOG_LINK_BRIDGE_TOKEN` on `stats-lc-api` in production.
- `YOUTUBE_MATCHING_ENABLED=false` disables YouTube Data API matching instantly.
- `DEEZER_MATCHING_ENABLED=false` disables Deezer public API lookup/search instantly, including `GET /api/deezer/search`.
- `RAPIDAPI_FALLBACKS_ENABLED=true` enables quota-limited RapidAPI fallbacks when `RAPIDAPI_KEY` is also set. It is disabled by default.
- `RAPIDAPI_KEY` is the server-side RapidAPI key. Never expose it in frontend code or logs.
- `RAPIDAPI_SPOTIFY_ENABLED=false` disables the Spotify23 fallback.
- `RAPIDAPI_SPOTIFY_WEB_API3_ENABLED=false` disables the Spotify Web API3 secondary fallback.
- `RAPIDAPI_SHAZAM_ENABLED=false` disables the Shazam fallback for Apple Music direct-link recovery.
- `RAPIDAPI_SHAZAM_LOCALE` controls Shazam search locale and defaults to `en-US`.
- `RAPIDAPI_MUSICDATA_ENABLED=false` disables the MusicData YouTube video metadata fallback.
- `RAPIDAPI_YOUTUBE_MUSIC_ENABLED=false` disables the YouTube Music API3 fallback.
- `RAPIDAPI_DAILY_REQUEST_LIMIT` is a conservative per-instance guardrail for RapidAPI calls. The default is `8`; RapidAPI hard limits still apply globally.
- `RAPIDAPI_COUNTRY_CODE` controls the Spotify23 `gl` market parameter and defaults to `BR`.
- `MANUAL_LINK_TOKEN` publishes trusted manual corrections without relying only on metadata confidence.
- `YOUTUBE_API_KEY` is optional; without it, YouTube and YouTube Music only appear when a trusted provider, Songlink/Odesli, input link, or manual correction returns a direct video link. When one trusted YouTube video ID is present, the app shows both YouTube and YouTube Music using the same ID.

TIDAL support is temporarily paused. Do not add TIDAL env vars back unless the app is intentionally reintroducing TIDAL as an automatic platform.

## Vercel environment scope notes

The linked Vercel project uses `main` as the Production Branch. The Vercel CLI currently refuses Preview env vars scoped to `main` with `branch_not_found` / "Cannot set Production Branch `main` for a Preview Environment Variable." For this repo, configure server secrets in Production for live deploys and Development for local `vercel dev`/pull workflows. Only add Preview env vars when a real non-production preview branch exists.

## Production key care

- Keep `.env.local` out of commits.
- Restrict `YOUTUBE_API_KEY` to YouTube Data API v3.
- Keep `RAPIDAPI_KEY` server-side only and rotate it if it appears in chat, logs, screenshots, or git.
- Monitor YouTube quota after deploys that touch matching.
- Rotate any key that is pasted into chat, logs, screenshots, or git by mistake.
- Keep `STATSLC_BRIDGE_TOKEN` synchronized with the matching token on `stats-lc-api`.
- Use `MANUAL_LINK_TOKEN` only for trusted/internal correction flows.
- Use the kill switches when provider cost or abuse is suspected:
  - `YOUTUBE_MATCHING_ENABLED=false`
  - `DEEZER_MATCHING_ENABLED=false`
  - `RAPIDAPI_FALLBACKS_ENABLED=false`
  - `SPOTIFY_WEB_MATCHING_ENABLED=false`
  - `STATSLC_BRIDGE_ENABLED=false`

## Tests

`npm run check` includes syntax checks and unit/integration tests. The database integration tests use free local Postgres-compatible adapters, so they have no cost and do not require a live Neon database.
