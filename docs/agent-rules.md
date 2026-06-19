# Agent rules for safe changes

This repo is sensitive to small contract changes. Future agents should treat the link contract, cache behavior, and mobile result surface as protected product behavior.

## Product contract

- The automatic promise is only Spotify, Apple Music, Deezer, TIDAL, YouTube, and YouTube Music.
- Result cards must render only direct, openable links.
- Never show generated search URLs as result links.
- Never render missing platforms as failed rows.
- Use `missingPlatforms` only for discreet correction UI.
- Preserve `trackId`, `cacheStatus`, `links[].source`, and `missingPlatforms` in API responses.
- `GET /api/track` is read-only and must not call external providers.

## Matching and provider rules

- Check persistent cache before external providers.
- Cache hits should not drop fresher links from the current conversion result.
- Cache upgrades may add missing links, but must not replace a good direct link with a search URL or weaker link.
- Keep Songlink/Odesli before the YouTube Data API when it can return direct links. This saves quota.
- Use YouTube Data API only when a trusted YouTube/YouTube Music direct ID is still missing or when public YouTube metadata cannot be fetched.
- Preserve the YouTube metadata fallback chain:
  1. YouTube oEmbed;
  2. noembed;
  3. YouTube Data API `videos.list`.
- Preserve the Spotify Web matching kill switch: `SPOTIFY_WEB_MATCHING_ENABLED=false`.
- Preserve the YouTube matching kill switch: `YOUTUBE_MATCHING_ENABLED=false`.
- Preserve the Deezer matching/search kill switch: `DEEZER_MATCHING_ENABLED=false`.
- Preserve the TIDAL matching/search kill switch: `TIDAL_MATCHING_ENABLED=false`.
- Preserve the stats-lc bridge kill switch: `STATSLC_BRIDGE_ENABLED=false`.

## Known regression patterns

- Do not let public-card refresh overwrite `state.currentResult` with older partial cache data. Merge missing links into the current result instead.
- Do not compare platform labels before normalizing them. Inputs like `youtube music` must normalize to `youtubeMusic`.
- Do not treat generic metadata such as `musica encontrada`, `track found`, or `resultado por busca` as reliable title/artist truth.
- Do not build canonical keys from stale generic cache metadata when the input platform can provide cleaner metadata.
- Do not expose Deezer search URLs as result links; only direct `deezer.com/track/{id}` links are valid.
- Do not expose TIDAL search, album, artist, video, or playlist URLs as result links; only direct `tidal.com/browse/track/{id}` or `tidal.com/track/{id}` links are valid.
- Do not remove YouTube/YouTube Music pairing when a trusted video ID exists.
- Do not add UI rows for `notAvailable`, "nao localizado", or search fallback links.
- Do not broaden Apple/iTunes matching so much that a different artist can win just because the title is similar.
- Do not remove provider-attempt recording when touching provider code.

## Frontend rules

- Keep the current premium/mobile-first direction. Avoid broad redesigns unless explicitly requested.
- The result modal/sheet and public card must use the same direct-link-only contract.
- Correction UI should be discreet and shown only when a primary automatic platform is missing.
- Result counts, copy actions, and share payloads must count only visible direct links.
- Validate desktop and mobile when touching result layout, especially `390x844`.
- If the app uses cached public cards, validate that copy/share still works after `/api/track` refresh.

## Backend validation rules

- Run `npm run check` before calling a matching change done.
- Add or update tests for:
  - URL normalization;
  - canonical key creation;
  - provider scoring;
  - cache upgrade behavior;
  - no search URLs in returned links;
  - manual correction validation.
- For live provider changes, run a small production smoke test after deploy and record any upstream/provider boundary honestly.
- If a provider fails with `429`, `502`, `526`, or timeout, report that boundary instead of claiming a bad match is fixed.

## Security rules for agents

- Never print or commit raw secrets from `.env.local`.
- Do not expose `YOUTUBE_API_KEY`, `TIDAL_CLIENT_SECRET`, `DATABASE_URL`, `STATSLC_BRIDGE_TOKEN`, or `MANUAL_LINK_TOKEN` in frontend code.
- Do not add unauthenticated write endpoints without a pending/review state or a trusted token path.
- Keep manual corrections hidden unless confidence is high or a trusted token is supplied.
- If adding expensive provider calls, document the quota impact in `docs/security.md` and keep a kill switch.
