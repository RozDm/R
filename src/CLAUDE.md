# Worker notes (src/)

Loaded when working under `src/`. Site-wide map: root `CLAUDE.md`; deploy and
ops workflows: `.github/CLAUDE.md`; incident background: `docs/history.md`.

## Modules

- `index.ts` — entry, run only for `/api/*` and the MTA-STS policy (Rules
  below): HTTPS, the policy on any host, canonical-host 301s for the API
  (www and mta-sts are the edge's, this is a backstop; workers.dev is off),
  dispatches `/api/*` to `routes/`, hands an `/api/` path no route claims to
  the 404 page (with the `_headers` set, which never reaches a Worker
  response), cron dispatch (5-min health checks + daily contact prune) and
  the status-alert mail.
- `routes/` — one handler per endpoint: `status`, `views`, `geo`, `visit`,
  `timeseries`, `contact`, `csp-report`, and `mta-sts` (the one outside
  `/api/`, dispatched ahead of the host checks). Each takes the parsed `URL`
  and returns `null` when the path isn't its own; `index.ts` chains them with
  `??`. Pure logic goes in a top-level `src/*.ts` module, not in a route.
- `http.ts` — `apiJson()` (JSON + security headers), the edge-cache pair
  `cachedApiJson()`/`putCachedApiJson()`, `allowWrite()` and
  `readCapped()` (a body read that gives up past a byte cap).
- `csp.ts` — security headers and CSP, shared with the build: `metaCsp`,
  `withMetaCsp` and `cspProblems` run in `scripts/finalize-export.mjs` /
  `scripts/check-csp.mjs` (Node imports the `.ts` directly).
- `status.ts` — uptime cron config (`monitors(env)`; NetBox's URL is the
  `NETBOX_URL` secret) + pure snapshot/alert logic.
- `contact.ts` — pure contact/alert mail logic: validation limits, Turnstile
  verify, MIME building, the time windows over `contact`
  (`CONTACT_WINDOWS_MS`, `isoCutoff`).
- `metrics.ts` — slug/country validation, bot filter, the `isWriteAllowed`
  header gate.
- `ip.ts` — `clientKey(ip)`: the rate-limit identity of an address — IPv4
  as is, IPv6 as its /64 (`expandIpv6` first: a naive split of
  `2001:db8::1` keys every address apart), IPv4-mapped back to IPv4.
- `timeseries.ts` — metric/range parsing, AE SQL builder + response parser,
  `METRICS_EPOCH`.

## Bindings and data

- KV `STATUS` holds only the uptime snapshot (`status` key), written only by
  the 5-minute cron. The free tier is 1000 KV writes/day: never add a
  per-request KV write — per-request data goes to D1 (100k writes/day) or AE
  (100k points/day on Free, shared by every channel).
- D1 `rozsoshnykh-metrics-v2` (`METRICS`, schema `schema/metrics.sql`):
  `views(slug, count)`, `geo(country, count)`,
  `contact(id, at, ip, name, email, message)`. Counters are atomic
  `INSERT … ON CONFLICT … count = count + 1`.
- Analytics Engine `rozsoshnykh_metrics` (`METRICS_AE`), channel in `blob1`:
  `geo` — every `recordGeo` call, `blob2` country, `blob3` `AS<asn>`, `blob4`
  network org (a bot diagnostic; AE only, no IP); `view` — `/api/views`
  POSTs, not graphed yet; `csp` — browser CSP reports. Reads need the runtime
  secrets `CF_ACCOUNT_ID` + `AE_API_TOKEN` (`Account Analytics:Read`);
  missing either, or an AE answer slower than 8 s, → empty series. Quote every AE SQL `INTERVAL` literal
  (`INTERVAL '6' HOUR`) — the bare form 422s.
- `METRICS_EPOCH` filters pre-relaunch AE points (AE is append-only). It must
  sit on a 6-hour UTC boundary (00/06/12/18; unit-tested in
  `tests/timeseries.test.ts`) — a mid-bucket epoch drops a straddling 6h
  bucket's visits and the chart undercounts the map. Bump it after every
  `reset-metrics` run, rounding UP.
- `WRITE_LIMITER` (ratelimits, 20/min per key, per Cloudflare location):
  `allowWrite(env, request, scope)` in `http.ts` keys it
  `<scope>:<clientKey(ip)>` (IPv6 → its /64, `ip.ts`) for
  `/api/visit` (429), `/api/views` POST (falls back to a read) and
  `/api/csp-report` (silent 204). It fails open. The header gates are
  spoofable; this is what stops a POST loop from burning D1's write quota.
- Runtime secrets (`TURNSTILE_SECRET`, `CF_ACCOUNT_ID`, `AE_API_TOKEN`,
  `NETBOX_URL` — NetBox's admin URL for `monitors()`) are
  not in `wrangler.jsonc`; they're typed in `src/env.d.ts` and synced by
  `deploy.yml`. `CF_ACCOUNT_ID` isn't really secret, but moving it to `vars`
  was declined (2026-10-22): no gain worth a delete-then-deploy step.

## API surface

- `/api/status` — GET, edge-cached 60s. Public, so `buildStatusData` strips
  monitor URLs (`PublicMonitorResult`); don't put them back — one monitor is
  an admin login page. Alert mails take the URL from the cron's own probes.
- `/api/views/<slug>` — GET reads; POST counts, gated by `isWriteAllowed`
  AND the slug resolving to a published post page via ASSETS (`/blogg/<slug>/`
  or, for an English-only post, `/en/blog/<slug>/`), so junk slugs can't mint
  D1 rows. The slug is the post's view key (`lib/blog.ts viewKey`): both
  language versions of a post count into the Norwegian slug.
- `/api/geo` — GET, edge-cached 60s. A failed D1 read is a 503 (logged,
  never cached), not an empty map: `smoke.sh` and the hourly
  `status-watchdog.yml` probe D1 through it, and the map shows its "failed"
  state instead of «no visitors yet».
- `/api/visit` — POST is the Besøk beacon (sent once per browser per day on
  the first human input, never under automation — `lib/visit.ts`; nothing
  here can check that, so the gates below still matter):
  `recordGeo(env, ctx, request.cf?.country, { asn, org })` writes the D1
  `geo` row and the AE point. GET is a harmless self-diagnostic (the
  caller's country + whether it counts).
- `/api/timeseries?metric=view|geo&range=24h|7d|30d|all` — GET, edge-cached
  per metric+range; `view` is still served for API compat, only `geo` is
  graphed; `all` spans ~90 days at 6h buckets.
- `/api/contact` — POST: a 32 KB body cap first (413, by Content-Length
  and while reading — smoke-checked), Sec-Fetch + UA filter, honeypot,
  Turnstile (when `TURNSTILE_SECRET` is set; siteverify bounded at 5 s and
  its `hostname` must be the request's host), an e-mail pattern without
  `<>,;"()[]\:` (it lands in `Reply-To: <…>`), D1 rate limits (per sender — `contact.ip`
  holds `clientKey(ip)`, an IPv6 /64 rather than the address — and per
  e-mail), and a 2-minute content dedup
  (same address + message → ack'd without a second mail).
- `/api/csp-report` — POST → always 204, AE only, never D1/KV (anyone can
  POST to it); `parseCspReports` keeps own-origin reports only (origin +
  path; no query, UA or IP). GET → 405, which the smoke test checks.
- `/.well-known/mta-sts.txt` — GET, any host; senders fetch it from
  `mta-sts.rozsoshnykh.no` (a custom domain in `wrangler.jsonc`). Proxies
  Cloudflare Email Routing's policy (`mta-sts.mx.cloudflare.net`; edge-cached
  1 h) as text/plain, because our `_mta-sts` TXT is a CNAME to theirs: when
  they bump its id, senders refetch and get their new policy from here — a
  copy in `public/` could name stale MX hosts and bounce mail under
  `mode: enforce`. Anything but a policy upstream → 503 (senders keep their
  cached copy). The edge 301s every other path on that host to the apex
  (`zone-rules.yml`); `smoke.sh` checks the policy, `zone-rules.yml` that it
  isn't redirected.
- A new `/api/*/<slug>` route must be added to the WAF rule's exemptions
  (`.github/waf/scanner-block.expr`, like `/api/views/`): its word patterns
  would 403 a slug such as `jenkins-pipeline`, and `check-waf` sees only
  built pages, not Worker routes.

## Rules

- Two tsconfigs: `src/` type-checks under `tsconfig.worker.json` (Workers
  types from the generated `worker-configuration.d.ts` — run
  `npm run cf-typegen` after any `wrangler.jsonc` change or wrangler bump and
  commit it; `wrangler types --check` in `npm run typecheck` enforces it).
  `csp.ts`, `contact.ts`, `status.ts`, `metrics.ts`, `timeseries.ts` and
  `ip.ts` are ALSO checked under the app tsconfig — tests import them, and the app
  imports `status.ts` (`isStale`, `HISTORY_LIMIT`) and `timeseries.ts`
  (`METRICS_EPOCH`, `normalizeBucketKey`). DOM-compatible APIs only in those
  six files, no Workers-only globals.
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
  fetch with `cache: 'no-store'`. Keep both. `zone-rules.yml` now sets
  Browser Cache TTL → "Respect Existing Headers" (`browser_cache_ttl: 0`),
  which stops the rewrite; `withStoredTtl` stays as the backstop.
- CSP: `metaCsp(hashes)` — each page's own policy, baked into it at build
  as a `<meta>` right after the charset, ahead of any script (`COMMON_DIRECTIVES` incl.
  `upgrade-insecure-requests`, minus `frame-ancestors`, + `report-to` →
  `/api/csp-report`; `<meta>` can't carry `report-uri`, so only Chromium
  reports — verified 2026-10-22 to report from `<meta>` like from a header);
  `HEADER_CSP` on every asset-server response (`public/_headers` `/*`, equal
  by test): `frame-ancestors`/`object-src`/`base-uri`/`form-action` only —
  both policies are enforced, so a fetch directive there would block the
  hashed inline scripts; `ENFORCED_CSP` for the Worker's JSON + redirects
  (no `unsafe-inline` — nothing executes inline there).
  Scripts the EDGE injects into a page (Bot Fight Mode's JavaScript
  Detections, Rocket Loader, Zaraz, Web Analytics' automatic setup) are never
  in the hash list or on the host list: the browser refuses them and each
  refusal is a CSP report — one Worker request (`docs/cloudflare-security.md`).
  JavaScript Detections is off zone-wide (`enable_js: false`, applied by
  `zone-rules.yml`) and Web Analytics is gone (no `cloudflareinsights` host,
  `docs/history.md`); turn nothing on that injects a script — `smoke.sh`
  ("no edge script") fails when `/`, fetched as a browser, carries an
  injected `<script>` (`data-cf-beacon` or a `/cdn-cgi/` src) or the JSD
  loader. Turnstile's iframe logs `Refused to connect to
  'data:,'` (2–3× per widget run) on `/kontakt/` + `/en/contact/`: that is
  Cloudflare's own iframe CSP (its `connect-src` lists
  `hagen.challenges.cloudflare.com` …), which has no report directives, and
  our policy can't reach a cross-origin iframe — nothing arrives at
  `/api/csp-report`. Neither a `parseCspReports` filter nor `data:` in our
  `connect-src` would change it; leave it (tested in `tests/csp.test.ts`).
  Trusted Types (`require-trusted-types-for 'script'`) is not on: measured
  2026-10-22, Next 16's chunk loader assigns `script.src` a plain string, so
  the lazy sections and client navigation throw under it. Revisit when
  Next ships Trusted Types support; a hand-written `default` policy is the
  only workaround, not worth it for a site with no user-supplied HTML.
- Only `/api/*` and the MTA-STS policy run the Worker (`run_worker_first:
  ["/api/*", "/.well-known/mta-sts.txt"]`; keep the key — without it a
  navigation to `/api/status` would get the 404 page).
  Every Worker invocation counts against the free plan's 100k requests/day
  (past it, a 429); the asset server's answers are free and outlive it, so
  pages, files and misses (the 404 page — measured in `wrangler dev`, and in
  prod by the `_headers` cache on a static miss) never cost a request. They
  take their headers from `public/_headers` (security set on `/*`,
  `X-Frame-Options` on the page paths, `immutable` on `/_next/static/*`, a
  week on the stable files, a PNG type on the OG cards), which never
  applies to a Worker response — `tests/static-assets.test.ts` keeps it
  equal to `BASE_SECURITY_HEADERS` + HSTS + `HEADER_CSP` and lets no header
  sit in two rules (they'd join with a comma). The zone's rate limiting rule
  excludes the static prefixes by hand (`docs/cloudflare-security.md`). A
  miss is still stamped with its path's `_headers` cache — the zone rule
  from `zone-rules.yml` (`.github/CLAUDE.md`) overrides it to `no-store` on
  every 4xx/5xx. HTML is `max-age=0, must-revalidate` with an ETag (304s) —
  as long as the zone's HTML-rewriting features stay off (`zone-rules.yml`):
  they strip it.
  `smoke.sh` canary: world.svg carries the week's cache AND no
  `X-Frame-Options` (proof it skipped the Worker).
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
  `<html lang="nb">`; `scripts/finalize-export.mjs` rewrites it to
  `lang="en"` under `out/en/` (smoke-checked). The 404 page served for a
  missing `/en/…` path still says `nb` (`HtmlLang` fixes it on the client).
- Slash-less paths: `out/_redirects` 301s every page (`/blogg` → `/blogg/`,
  generated at build); anything else gets `html_handling`'s 307
  (`…/index.html` → `…/`). `/favicon.ico` is a build-time copy of
  `/icons/favicon.ico`.
- Failures swallowed for availability (D1 upserts, mail sends, prune) still
  `console.error` — Workers Logs is the only place they show. Traces stay
  off (`"traces": {}` in `wrangler.jsonc` enables nothing) — owner's call,
  2026-10-22: from 2026-12-01 logs and traces share Free's 0.5 GB/day
  (7-day retention), and past it ingestion stops until 00:00 UTC, logs
  included; logs answer what traces would.

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
