# Environment setup

This app works without paid services. Persistent shared cache needs a Postgres-compatible URL.

## Required for shared cache

Set `DATABASE_URL` to a Postgres/Neon connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require"
```

Free setup path:

1. Create a free Neon Postgres database.
2. Copy the pooled connection string.
3. Add it to `.env.local` for local development or to Vercel environment variables for production.
4. Run:

```bash
npm run check:env
npm run check
```

When `DATABASE_URL` is absent, the API still converts links, but `tracks`, `track_links`, `track_aliases`, and `provider_attempts` are not persisted.

## Optional variables

```bash
SPOTIFY_WEB_MATCHING_ENABLED="true"
MANUAL_LINK_TOKEN=""
YOUTUBE_API_KEY=""
```

- `SPOTIFY_WEB_MATCHING_ENABLED=false` disables Spotify Web Player matching instantly.
- `MANUAL_LINK_TOKEN` publishes trusted manual corrections without relying only on metadata confidence.
- `YOUTUBE_API_KEY` is optional; without it, YouTube and YouTube Music only appear when a trusted provider or manual correction returns direct video links.

## Tests

`npm run check` includes syntax checks and unit/integration tests. The database integration test uses an in-memory Postgres-compatible adapter, so it has no cost and does not require a live Neon database.
