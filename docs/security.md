# Security and abuse plan

This app is not "blindado" by default. It has useful application-level safeguards, and Vercel provides automatic DDoS protection, but production should still be treated as an internet-facing API that can be abused.

## Current safeguards

- `POST /api/convert` accepts only `POST`.
- `GET /api/track` accepts only `GET` and validates `trackId` with a strict `trk_...` pattern.
- `GET /api/deezer/search` accepts only `GET`, validates query length/junk patterns, clamps pagination, and respects `DEEZER_MATCHING_ENABLED=false`.
- `GET /api/tidal/search` accepts only `GET`, validates query length/junk patterns, clamps pagination cursor/limit, requires server-side TIDAL credentials, and respects `TIDAL_MATCHING_ENABLED=false`.
- `POST /api/manual-link` validates platform, host, and URL shape before writing anything.
- Search URLs and platform mismatches are rejected by the shared music contract.
- Link inputs are length-limited and restricted to known music hosts.
- Query inputs are length-limited and reject obvious junk patterns.
- `POST /api/convert` has in-memory rate limits:
  - link mode: 5 requests per 10 seconds and 20 requests per 60 seconds;
  - query mode: 3 requests per 10 seconds and 10 requests per 60 seconds;
  - after repeated strikes, the caller is blocked for 10 minutes.
- `POST /api/convert` has an in-memory concurrency cap of 40 in-flight requests per instance.
- Low-confidence manual corrections are stored as `pending` and are hidden from public cards.
- `DATABASE_URL`, `YOUTUBE_API_KEY`, `TIDAL_CLIENT_SECRET`, `STATSLC_BRIDGE_TOKEN`, and `MANUAL_LINK_TOKEN` are server-side secrets and must not be exposed in frontend code.

## Remaining risk

- In-memory rate limits are per serverless instance. They help normal abuse, but they are not a full distributed-abuse barrier.
- `vercel.json` currently does not declare security headers, challenge rules, or edge rate limits.
- A burst of cache misses can spend YouTube Data API quota, consume Deezer public API quota, consume TIDAL API quota/access tier, and slow down provider calls.
- Public endpoints are anonymous, so abuse controls must assume no account identity.
- Manual correction is intentionally public, but incorrect submissions must stay hidden unless trusted.
- Third-party provider failures can create partial results; the UI should hide missing platforms rather than show dead rows.

## Recommended Vercel hardening

Configure these in the Vercel Firewall dashboard or Firewall API. Roll out in log/challenge mode first when available, then tighten once traffic looks normal.

1. Enable Bot Protection.
2. Enable BotID traffic visibility if available.
3. Add an edge rate limit for `POST /api/convert`.
   - Suggested starting point: 30 requests per minute per IP.
   - If false positives appear, raise the limit or use challenge instead of deny.
4. Add a stricter edge rate limit for `POST /api/manual-link`.
   - Suggested starting point: 10 requests per minute per IP.
5. Add a rule to challenge obvious script clients on API paths, such as empty user agents and common command-line user agents.
6. Keep Attack Challenge Mode available for active abuse events.
7. Add deny rules for obvious scanner paths such as `/wp-admin`, `/wp-login.php`, `/.env`, `/phpmyadmin`, and similar non-app paths.

Vercel's automatic DDoS protection is useful, but it should be considered the baseline, not the complete security plan.

## Security headers

Add headers either in `vercel.json` or through Vercel configuration. Start with conservative values that do not break the app:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Content-Security-Policy` after testing external assets and platform links carefully.

The current app uses external image/media URLs and opens third-party music platforms, so CSP should be tested in report-only mode before enforcing.

## Secret and quota care

- Never commit `.env.local` or raw API keys.
- Keep the YouTube API key restricted to YouTube Data API v3.
- Prefer server-side usage only for the YouTube key.
- Monitor YouTube Data API quota, Deezer provider errors, and TIDAL provider errors after matching changes.
- Monitor TIDAL auth/rate/access-tier errors after matching changes.
- Rotate leaked or pasted keys immediately.
- Keep `STATSLC_BRIDGE_TOKEN` aligned with the corresponding token in `stats-lc-api`.
- Use `MANUAL_LINK_TOKEN` only for trusted internal correction flows.

## Monitoring checklist

After deploys that touch matching or providers:

- Run `npm run check`.
- Smoke-test one Spotify, one Apple Music, one Deezer, one TIDAL, and one YouTube Music input.
- Smoke-test `GET /api/deezer/search?q=Daft%20Punk%20One%20More%20Time`.
- Smoke-test `GET /api/tidal/search?q=Daft%20Punk%20One%20More%20Time`.
- Check that no result link is a search URL.
- Check Vercel error/fatal logs after production smoke tests.
- Watch for spikes in `429`, `5xx`, provider errors, and YouTube quota usage.
- Watch for Deezer `QUOTA`/`SERVICE_BUSY` errors, TIDAL auth/rate/access-tier errors, and local `deezer_api`/`tidal_api` provider attempts.
- Check whether repeated cache misses are coming from the same IP, ASN, or user agent.

## Incident response

If the app is under obvious abuse:

1. Enable Vercel Attack Challenge Mode.
2. Temporarily lower the edge rate limit for `/api/convert`.
3. Disable expensive providers with env kill switches if needed:
   - `YOUTUBE_MATCHING_ENABLED=false`
   - `DEEZER_MATCHING_ENABLED=false`
   - `TIDAL_MATCHING_ENABLED=false`
   - `SPOTIFY_WEB_MATCHING_ENABLED=false`
   - `STATSLC_BRIDGE_ENABLED=false`
4. Block or challenge abusive IPs, ASNs, user agents, or countries only after checking logs.
5. Rotate affected secrets if there is any sign of exposure.
6. After recovery, add a regression note to this document or `docs/agent-rules.md`.
