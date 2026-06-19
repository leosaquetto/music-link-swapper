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
MANUAL_LINK_TOKEN=""
YOUTUBE_API_KEY=""
```

- `SPOTIFY_WEB_MATCHING_ENABLED=false` disables Spotify Web Player matching instantly.
- `STATSLC_BRIDGE_ENABLED=false` disables the internal stats-lc/stats.fm catalog bridge instantly.
- `STATSLC_BRIDGE_URL` points to the stats-lc API bridge used to enrich Spotify and Apple Music IDs before text-search fallbacks.
- `STATSLC_BRIDGE_TOKEN` is optional locally, but should match `CATALOG_LINK_BRIDGE_TOKEN` on `stats-lc-api` in production.
- `YOUTUBE_MATCHING_ENABLED=false` disables YouTube Data API matching instantly.
- `MANUAL_LINK_TOKEN` publishes trusted manual corrections without relying only on metadata confidence.
- `YOUTUBE_API_KEY` is optional; without it, YouTube and YouTube Music only appear when a trusted provider, Songlink/Odesli, input link, or manual correction returns a direct video link. When one trusted YouTube video ID is present, the app shows both YouTube and YouTube Music using the same ID.

## Production key care

- Keep `.env.local` out of commits.
- Restrict `YOUTUBE_API_KEY` to YouTube Data API v3.
- Monitor YouTube quota after deploys that touch matching.
- Rotate any key that is pasted into chat, logs, screenshots, or git by mistake.
- Keep `STATSLC_BRIDGE_TOKEN` synchronized with the matching token on `stats-lc-api`.
- Use `MANUAL_LINK_TOKEN` only for trusted/internal correction flows.
- Use the kill switches when provider cost or abuse is suspected:
  - `YOUTUBE_MATCHING_ENABLED=false`
  - `SPOTIFY_WEB_MATCHING_ENABLED=false`
  - `STATSLC_BRIDGE_ENABLED=false`

## Tests

`npm run check` includes syntax checks and unit/integration tests. The database integration tests use free local Postgres-compatible adapters, so they have no cost and do not require a live Neon database.
