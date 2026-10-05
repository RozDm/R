# Worker notes (src/)

Loaded when working under `src/`. Site-wide map: root `CLAUDE.md`; deploy and
ops workflows: `.github/CLAUDE.md`; incident background: `docs/history.md`.

## Modules

- `index.ts` — entry: HTTPS + canonical-host 301s (www/workers.dev → apex),
  `/status/` → `/#status`, dispatches `/api/*` to `routes/`, per-request
  **hash-based CSP** for HTML it can decode (+ a `Reporting-Endpoints`
  header), cron dispatch (5-min health checks + daily contact prune) and the
  status-alert mail.
- `routes/` — one handler per endpoint: `status`, `views`, `geo`, `visit`,
  `timeseries`, `contact`, `csp-report`. Each takes the parsed `URL` and
  returns `null` when the path isn't its own; `index.ts` chains them with
  `??`. Pure logic goes in a top-level `src/*.ts` module, not in a route.
- `http.ts` — `apiJson()` (JSON + security headers) and the edge-cache pair
  `cachedApiJson()`/`putCachedApiJson()`.
- `csp.ts` — security headers, CSP and `cacheControlFor()`.
- `status.ts` — uptime cron config (`MONITORS`) + pure snapshot/alert logic.
- `contact.ts` — pure contact/alert mail logic: validation limits, Turnstile
  verify, MIME building, the time windows over `contact`
  (`CONTACT_WINDOWS_MS`, `isoCutoff`).
- `metrics.ts` — slug/country validation, bot filter, the `isWriteAllowed`
  header gate.
- `timeseries.ts` — metric/range parsing, AE SQL builder + response parser,
  `METRICS_EPOCH`.

## Bindings and data

- KV `STATUS` holds only the uptime snapshot (`status` key), written only by
  the 5-minute cron. The free tier is 1000 KV writes/day: never add a
  per-request KV write — per-request data goes to D1 (100k writes/day) or AE
  (10M points/day).
- D1 `rozsoshnykh-metrics-v2` (`METRICS`, schema `schema/metrics.sql`):
  `views(slug, count)`, `geo(country, count)`,
  `contact(id, at, ip, name, email, message)`. Counters are atomic
  `INSERT … ON CONFLICT … count = count + 1`.
- Analytics Engine `rozsoshnykh_metrics` (`METRICS_AE`), channel in `blob1`:
  `geo` — every `recordGeo` call, `blob2` country, `blob3` `AS<asn>`, `blob4`
  network org (a bot diagnostic; AE only, no IP); `view` — `/api/views`
  POSTs, not graphed yet; `csp` — browser CSP reports. Reads need the runtime
  secrets `CF_ACCOUNT_ID` + `AE_API_TOKEN` (`Account Analytics:Read`);
  missing either → empty series. Quote every AE SQL `INTERVAL` literal
  (`INTERVAL '6' HOUR`) — the bare form 422s.
- `METRICS_EPOCH` filters pre-relaunch AE points (AE is append-only). It must
  sit on a 6-hour UTC boundary (00/06/12/18; unit-tested in
  `tests/timeseries.test.ts`) — a mid-bucket epoch drops a straddling 6h
  bucket's visits and the chart undercounts the map. Bump it after every
  `reset-metrics` run, rounding UP.
- `WRITE_LIMITER` (ratelimits, 20/min per key, per Cloudflare location):
  `allowWrite(env, request, scope)` in `http.ts` keys it `<scope>:<ip>` for
  `/api/visit` (429), `/api/views` POST (falls back to a read) and
  `/api/csp-report` (silent 204). It fails open. The header gates are
  spoofable; this is what stops a POST loop from burning D1's write quota.
- Runtime secrets (`TURNSTILE_SECRET`, `CF_ACCOUNT_ID`, `AE_API_TOKEN`) are
  not in `wrangler.jsonc`; they're typed in `src/env.d.ts` and synced by
  `deploy.yml`.

## API surface

- `/api/status` — GET, edge-cached 60s. Public, so `buildStatusData` strips
  monitor URLs (`PublicMonitorResult`); don't put them back — one monitor is
  an admin login page. Alert mails take the URL from the cron's own probes.
- `/api/views/<slug>` — GET reads; POST counts, gated by `isWriteAllowed`
  AND the slug resolving to a published post page via ASSETS, so junk slugs
  can't mint D1 rows.
- `/api/geo` — GET, edge-cached 60s.
- `/api/visit` — POST is the Besøk beacon:
  `recordGeo(env, ctx, request.cf?.country, { asn, org })` writes the D1
  `geo` row and the AE point. GET is a harmless self-diagnostic (the
  caller's country + whether it counts).
- `/api/timeseries?metric=view|geo&range=24h|7d|30d|all` — GET, edge-cached
  per metric+range; `view` is still served for API compat, only `geo` is
  graphed; `all` spans ~90 days at 6h buckets.
- `/api/contact` — POST: Sec-Fetch + UA filter, honeypot, Turnstile (when
  `TURNSTILE_SECRET` is set), D1 rate limits, and a 2-minute content dedup
  (same address + message → ack'd without a second mail).
- `/api/csp-report` — POST → always 204, AE only, never D1/KV (anyone can
  POST to it); `parseCspReports` keeps own-origin reports only (origin +
  path; no query, UA or IP). GET → 405, which the smoke test checks.

## Rules

- Two tsconfigs: `src/` type-checks under `tsconfig.worker.json` (Workers
  types from the generated `worker-configuration.d.ts` — run
  `npm run cf-typegen` after any `wrangler.jsonc` change and commit it).
  `csp.ts`, `contact.ts`, `status.ts`, `metrics.ts` and `timeseries.ts` are
  ALSO checked under the app tsconfig — tests import them, and the app
  imports `status.ts` (`isStale`, `HISTORY_LIMIT`) and `timeseries.ts`
  (`METRICS_EPOCH`, `normalizeBucketKey`). DOM-compatible APIs only in those
  five files, no Workers-only globals.
- A Worker can't fetch its own public URL (Cloudflare blocks the loop).
  Anything that needs the site goes through the ASSETS binding: the
  `/api/views` slug check and `internal: true` monitors (supported, none
  configured). Don't monitor the site itself — it serves the dashboard.
- The write gates (`isWriteAllowed`: Sec-Fetch-Site + UA filter) are bot
  hygiene, NOT security — the headers are trivially spoofable. Anything with
  real consequences needs its own defence (contact: Turnstile + rate limits;
  views: the ASSETS slug check).
- Edge-cached endpoints build the cache key from validated params only
  (`cachedApiJson(canonicalUrl)`) — junk query strings must not fragment
  (and so bypass) the cache. A cache hit re-sets the stored TTL
  (`withStoredTtl`) because the zone's Browser Cache TTL (4 h default)
  rewrites `max-age` on edge HITs (`s-maxage` is untouched); clients also
  fetch with `cache: 'no-store'`. Keep both. Dashboard-side fix: Browser
  Cache TTL → "Respect Existing Headers".
- CSP: three policies sharing `COMMON_DIRECTIVES` (incl.
  `upgrade-insecure-requests`): `strictCsp(hashes)` for readable HTML (with
  `report-uri`/`report-to` → `/api/csp-report`); `ENFORCED_CSP` for non-HTML
  assets + redirects (no `unsafe-inline` — nothing executes inline there);
  `HTML_FALLBACK_CSP` (keeps `unsafe-inline`) only for HTML that couldn't be
  decoded to hash — effectively unreachable, assets are fetched as identity.
- Asset caching (`cacheControlFor()`, non-HTML branch): the Assets binding
  tags every file `max-age=0, must-revalidate` and the Worker re-fetches
  without `If-None-Match`, so without an override every repeat visit
  re-downloads in full. `/_next/static/*` (content-hashed) → `immutable`;
  `/world.svg`, `/fonts/*`, `/icons/*` → 1 week; HTML stays no-cache (the
  per-request hash-CSP needs a fresh document). `smoke.sh` guards the
  world.svg header as the canary.
- Status alerts are flap-damped (`CONSECUTIVE_FAILS_TO_ALERT = 2`): «nede»
  mails only on the second consecutive failed probe, «oppe igjen» on the
  first success after an alerted outage. `isStale`/`STALE_AFTER_MS` (15 min)
  grey out the dashboard banner and footer dot when the cron stops writing.
  `HISTORY_LIMIT = 149` is the monolith's 1:4:9 — intentional, don't "fix"
  it.
- Contact: a failed mail send deletes its D1 row (else the 2-minute dedup
  would ack the visitor's retry without mailing it). Windows over
  `contact.at` (ISO strings) are ISO cutoffs from `isoCutoff()` bound as
  parameters — NEVER `datetime('now', …)`: its "YYYY-MM-DD HH:MM:SS" form
  mis-compares with ISO as TEXT and makes every same-day row look recent.
- `/en/` HTML: the export has one root layout, so every page says
  `<html lang="nb">`; the HTML branch rewrites it to `lang="en"` for `/en`
  paths (smoke-checked). The hash CSP is unaffected — it covers inline
  scripts, not attributes.
- Assets are fetched with `redirect: 'manual'`: a Request built in the Worker
  follows redirects by default, which served `/blogg` as a 200 duplicate. The
  binding's `html_handling` 307s (`/blogg` → `/blogg/`, `…/index.html` → `…/`)
  go out as 301s. `/favicon.ico` is rewritten to the build-time
  `/icons/favicon.ico`.
- Failures swallowed for availability (D1 upserts, mail sends, prune) still
  `console.error` — Workers Logs is the only place they show.

## Tests

- Route handlers are tested in `tests/worker/` under plain Vitest with
  in-process bindings from `tests/worker/fakes.ts`: D1 is REAL SQLite
  (`node:sqlite`, Node ≥ 22.5) loaded with `schema/metrics.sql`, so SQL
  semantics match production; AE, Email Routing and ASSETS are fakes, and
  `cloudflare:email` is aliased to a stub in `vitest.config.ts`. They
  type-check under `tsconfig.worker.json` (Node bits in `node-shims.d.ts`)
  and are excluded from the app tsconfig.
- A new endpoint or route behaviour gets a test there AND a
  `scripts/smoke.sh` check. Not `@cloudflare/vitest-pool-workers` (it pins
  its own older wrangler and an alpha miniflare).
