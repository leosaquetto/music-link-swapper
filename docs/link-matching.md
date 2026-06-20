# Link matching and cache strategy

The product follows a Tapelink-style regular link promise:

- Automatic links are limited to Spotify, Apple Music, Deezer, YouTube, and YouTube Music.
- Result cards render only direct, openable links.
- Generated search URLs are never valid display links.
- Missing platforms are exposed only as `missingPlatforms` for correction prompts, not as failed rows.

Agent-facing rules for preserving this behavior live in [`agent-rules.md`](./agent-rules.md).

## Provider order

`POST /api/convert` checks cheap and trusted sources before expensive or fragile lookups:

1. Postgres/Neon cache by normalized input URL.
2. Postgres/Neon cache by canonical track key.
3. Input metadata context for Spotify, Apple Music, Deezer, YouTube, and YouTube Music.
4. Direct input link preservation when the submitted URL is already a valid platform link.
5. stats-lc bridge for Spotify and Apple Music enrichment from stats.fm catalog IDs.
6. Spotify Web Player matching when enabled.
7. RapidAPI Spotify23, then Spotify Web API3, only when explicitly enabled and Spotify is still missing.
8. Apple Music/iTunes lookup and search.
9. RapidAPI Shazam fallback only when explicitly enabled and Apple Music is still missing.
10. Deezer public API lookup/search when enabled.
11. Songlink/Odesli enrichment for direct links returned by that provider.
12. YouTube Data API matching only when still missing YouTube or YouTube Music.
13. RapidAPI YouTube Music API3 fallback only when explicitly enabled and YouTube links are still missing.
14. Manual correction, hidden unless a primary platform is missing.

Songlink/Odesli is intentionally before the YouTube Data API. If it returns a direct YouTube, YouTube Music, Apple Music, Deezer, or Spotify link, the app can persist that result without spending YouTube API quota. This enrichment also runs when Deezer is the only missing automatic platform. If it returns only unrelated platforms or the same input platform, the app skips those links.

Cache hits that are missing platforms can be upgraded. Before upgrade, the API must apply reliable input metadata so stale partial rows such as `musica encontrada` or `resultado por busca` do not become canonical truth.

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
- `rapidapi_spotify23`
- `rapidapi_spotify_web_api3`
- `rapidapi_shazam`
- `itunes`
- `deezer_api`
- `songlink`
- `idhs`
- `youtube_api`
- `rapidapi_youtube_music_api3`
- `statslc_bridge`
- `manual`

The API also returns:

- `data.trackId`: the durable local track id when available.
- `data.cacheStatus`: `hit`, `miss`, or `partial`.
- `data.missingPlatforms`: supported automatic platforms that are still missing, for correction UI only.

Search URLs such as `open.spotify.com/search/...`, `deezer.com/search/...`, or `music.youtube.com/search?...` must not be returned as result links.

## Deezer

Deezer is a first-class automatic platform when the app has a trusted direct track id:

- input URL;
- cache;
- Deezer public API lookup/search;
- Songlink/Odesli or another trusted provider;
- accepted manual correction.

The app uses only public catalog endpoints. It does not require OAuth for this flow, does not expose preview/audio files, and never stores audio. Set `DEEZER_MATCHING_ENABLED=false` to disable Deezer lookup/search instantly.

The read-only search endpoint is:

```text
GET /api/deezer/search?q=<text>&limit=<1-20>&index=<0+>
```

It returns normalized Deezer track candidates for app/API use. Display cards still use only direct `/track/{id}` links; the search endpoint itself is not a display-link source unless a candidate has been selected and normalized to a direct track URL.

## TIDAL pause

TIDAL support is temporarily removed from the automatic platform promise while the registered app cannot use the `client_credentials` grant. There is no active TIDAL endpoint, no TIDAL provider probe, no TIDAL env contract, and TIDAL links returned by Songlink/Odesli are filtered out by the shared music contract.

## Public result cards

Cached results can be reopened through:

```text
/?track=trk_...
```

The frontend resolves that query through the read-only endpoint:

```text
GET /api/track?trackId=trk_...
```

The endpoint returns the same normalized result contract used by `POST /api/convert`, but only from the persistent music library. It does not rerun matching providers or create a new track.

Failure behavior is explicit:

- `400`: missing or malformed `trackId`.
- `503`: persistent library is not configured.
- `404`: the track is absent from cache or has no published direct links.

Only `track_links.status = 'published'` entries are exposed. Pending manual corrections remain private and do not appear on public cards. Before copying, sharing, or opening a public-card URL, the frontend validates the `trackId` against this endpoint and shows a toast instead of sharing a dead link when validation fails.

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

For YouTube and YouTube Music input metadata, preserve this fallback order:

1. YouTube oEmbed.
2. noembed.
3. RapidAPI MusicData `/youtube/video/{videoId}` when RapidAPI fallbacks are enabled.
4. YouTube Data API `videos.list`, only when the key is configured.

This metadata path is separate from search matching. It exists so official YouTube Music inputs can produce a reliable title/artist before Spotify, Apple Music, and YouTube matching run.

## RapidAPI limited fallbacks

RapidAPI providers are intentionally last-mile fallbacks, not primary matching:

- Spotify23 can fill a missing Spotify direct track link after the current free/internal Spotify paths miss.
- Spotify Web API3 can fill a missing Spotify direct track link if Spotify23 misses or is unavailable.
- Shazam can fill a missing Apple Music direct track link and cleaner title/artist metadata. Its Spotify and Deezer provider actions are search deeplinks, so they must never be returned as display links.
- MusicData can recover title/artist metadata for a submitted YouTube video id before spending YouTube Data API quota. That same trusted `videoId` can back both YouTube and YouTube Music links, but MusicData does not search for a new cross-platform match. Its stats links are metadata only, not display-link sources.
- YouTube Music API3 can fill a missing YouTube/YouTube Music pair after Songlink/Odesli and YouTube Data API miss.
- Apple Music RapidAPI is not used in the normal flow yet because iTunes Lookup/Search is free and already handles Apple links/search. It can be reconsidered later for controlled ISRC/metadata enrichment.

They require:

- `RAPIDAPI_FALLBACKS_ENABLED=true`
- `RAPIDAPI_KEY`
- provider switches left enabled, such as `RAPIDAPI_SPOTIFY_ENABLED=true`, `RAPIDAPI_SPOTIFY_WEB_API3_ENABLED=true`, `RAPIDAPI_SHAZAM_ENABLED=true`, `RAPIDAPI_MUSICDATA_ENABLED=true`, and `RAPIDAPI_YOUTUBE_MUSIC_ENABLED=true`

The implementation keeps a conservative in-memory daily quota via `RAPIDAPI_DAILY_REQUEST_LIMIT`. Because serverless instances do not share memory, production should still rely on the RapidAPI hard limits and logs. RapidAPI results must still pass the same direct-link-only contract; no RapidAPI search URL is ever returned to the frontend.

## Recent hardening notes

2026-06-19 matching fixes:

- Spotify found late through Spotify Web now triggers a second Apple/iTunes fallback before the response is persisted.
- Cache upgrade now applies input context before provider matching and before canonical-key decisions.
- Platform labels are normalized before comparison, including `youtube music` to `youtubeMusic`.
- Generic metadata such as `musica encontrada`, `track found`, and `resultado por busca` is treated as weak and can be replaced by trusted input/provider metadata.
- Apple/iTunes search has an alternate simplified query for live titles with venue/date suffixes.
- YouTube metadata can fall back from public embed endpoints to YouTube Data API `videos.list`.
- Production validation covered official YouTube Music, Apple Music, and Spotify examples returning the previous four automatic platforms with direct URLs. Deezer was added afterward and should be smoke-tested separately after deploy.
- RapidAPI Spotify23, Spotify Web API3, Shazam, MusicData, and YouTube Music API3 were added as disabled-by-default quota-limited fallbacks; smoke-test them only with `RAPIDAPI_FALLBACKS_ENABLED=true` and a low `RAPIDAPI_DAILY_REQUEST_LIMIT`.

Known fixtures that should keep working:

- `https://music.youtube.com/watch?v=qHqEcMqqGAA`
- `https://music.youtube.com/watch?v=mQh-ja7CgqM`
- `https://music.youtube.com/watch?v=fRF4mD5_xes`
- `https://music.apple.com/br/album/rel%C3%B3gio/1804102954?i=1804102956`
- `https://open.spotify.com/track/3ziJR4EpMEzjvdli8YIV6X`

Do not turn these into hardcoded matches. They are regression fixtures for provider behavior, metadata cleaning, and cache-upgrade logic.

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

Validation has two layers:

- Frontend and backend reject invalid URLs, search URLs, and platform mismatches before a correction can be accepted.
- Backend semantic confidence is available only when metadata can be fetched for the submitted platform. Apple Music uses iTunes Lookup, Spotify uses Spotify oEmbed, and Deezer uses Deezer track lookup. Corrections with weak or unavailable metadata remain pending unless a trusted correction token is provided.

YouTube and YouTube Music manual corrections currently do not fetch metadata in `POST /api/manual-link`; they should be treated as review-first unless submitted with a trusted token. This protects the shared cache from wrong-song submissions while still allowing useful user corrections to be collected.

## Regression checklist

Before deploying matching changes:

- Run `npm run check`.
- Run `npm run check:env`.
- Confirm `POST /api/convert` returns no `/search` URLs.
- Confirm `data.links` has no `notAvailable` display rows.
- Confirm `missingPlatforms` is used only for correction prompts, not dead platform rows.
- Confirm a cached `?track=trk_...` card loads and an unknown id shows the public-card error state.
- Confirm public-card refresh does not drop fresher links already present in the current result.
- Confirm pending manual links do not appear in `GET /api/track`.
- Test at least one Spotify input, one Apple Music input, one Deezer input, and one YouTube input.
- Test `/api/deezer/search?q=Daft%20Punk%20One%20More%20Time`.
- If RapidAPI fallbacks are enabled, test one Spotify miss and one YouTube/YouTube Music miss with a low daily limit.
- Test at least one YouTube Music official art-track input that starts from cache miss.
- Test at least one partial-cache upgrade when a platform is missing.
- Check Vercel runtime logs for error/fatal logs after production smoke tests.
