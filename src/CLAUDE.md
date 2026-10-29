# Worker notes (src/)

Loaded when working under `src/`. Site-wide map: root `CLAUDE.md`; CI and
ops workflows: `.github/CLAUDE.md`; incident background: `docs/history.md`.

## Modules

- `index.ts` — entry, run only for `/api/*` and the MTA-STS policy: HTTPS,
  the policy on any host, canonical-host 301s for the API (www and mta-sts
  are the edge's; this is the backstop), dispatch to `routes/`, an `/api/`
  path no route claims → the 404 page (with the `_headers` set, which never
  reaches a Worker response), the crons (5-min health checks, daily contact
  prune) and the status-alert mail.
- `routes/` — one handler per endpoint (`status`, `views`, `geo`, `visit`,
  `timeseries`, `contact`, `csp-report`, `mta-sts`); each takes the parsed
  `URL` and returns `null` when the path isn't its own, chained with `??`.
  Pure logic goes in a top-level `src/*.ts` module, not a route.
- `http.ts` — `apiJson()` (JSON + security headers), the edge-cache pair
  `cachedApiJson()`/`putCachedApiJson()`, `allowWrite()`, `readCapped()` (a
  body read that gives up past a byte cap).
- `csp.ts` — security headers and CSP, shared with the build (`metaCsp`,
  `withMetaCsp`, `cspProblems` run in `scripts/finalize-export.mjs` and
  `scripts/check-csp.mjs`; Node imports the `.ts` directly).
- `status.ts` — `monitors(env)` (NetBox's URL is the `NETBOX_URL` secret) +
  pure snapshot/alert logic.
- `contact.ts` — validation limits, Turnstile verify, MIME building (with the
  `Date` RFC 5322 requires and a `Message-ID`), the windows over `contact`
  (`CONTACT_WINDOWS_MS`, `isoCutoff`) and the prune's cron pattern
  (`CONTACT_PRUNE_CRON`, held equal to `wrangler.jsonc` by a test — the
  privacy notice promises 30 days).
- `metrics.ts` — slug/country validation, bot filter, the `isWriteAllowed`
  header gate (Sec-Fetch-Site when sent; else — Safari < 16.4 — the `Origin`
  must be ours).
- `ip.ts` — `clientKey(ip)`: IPv4 as is, IPv6 as its /64 (`expandIpv6`
  first), IPv4-mapped back to IPv4.
- `timeseries.ts` — metric/range parsing, AE SQL builder and parser,
  `METRICS_EPOCH`.

## Bindings and data

- KV `STATUS`: only the uptime snapshot (`status` key), written only by the
  5-minute cron. Free = 1000 KV writes/day: NEVER a per-request KV write —
  per-request data goes to D1 (100k writes/day) or AE (100k points/day,
  shared by every channel).
- D1 `rozsoshnykh-metrics-v2` (`METRICS`, `schema/metrics.sql`):
  `views(slug, count)`, `geo(country, count)`,
  `contact(id, at, ip, name, email, message)`; counters are atomic
  `INSERT … ON CONFLICT … count = count + 1`.
- AE `rozsoshnykh_metrics` (`METRICS_AE`), channel in `blob1`: `geo` (every
  `recordGeo`; `blob2` country, `blob3` `AS<asn>`, `blob4` network org — a
  bot diagnostic, no IP), `view` (`/api/views` POSTs, not graphed), `csp`
  (one point per report POST). Reads need `CF_ACCOUNT_ID` + `AE_API_TOKEN`
  (`Account Analytics:Read`); missing either, or AE slower than 8 s → empty
  series. Quote AE SQL `INTERVAL` literals (`INTERVAL '6' HOUR`; bare 422s).
- `METRICS_EPOCH` hides pre-relaunch AE points (AE is append-only). It must
  sit on a 6-hour UTC boundary (unit-tested; why: `docs/history.md`). Bump
  it after every `reset-metrics` run, rounding UP.
- `WRITE_LIMITER` (20/min per key, per location): `allowWrite(env, request,
  scope)` keys `<scope>:<clientKey(ip)>` for `/api/visit` (429),
  `/api/views` POST (falls back to a read), `/api/csp-report` (silent 204),
  `/api/contact` (429, a burst cap ahead of Turnstile — its D1 windows fail
  open). It fails open. The header gates are spoofable; this is what stops a
  POST loop burning D1's write quota.
- Runtime secrets (`TURNSTILE_SECRET`, `CF_ACCOUNT_ID`, `AE_API_TOKEN`,
  `NETBOX_URL`) aren't in `wrangler.jsonc`: typed in `src/env.d.ts`, synced
  by `deploy.yml`. (`CF_ACCOUNT_ID` → `vars` was declined: no gain.)

## API surface

- `/api/status` — GET, edge-cached 60 s. Public, so `buildStatusData`
  strips monitor URLs (`PublicMonitorResult`) — keep it so: one monitor is an
  admin login. Alert mails take the URL from the cron's own probes.
- `/api/views/<slug>` — GET reads; POST counts when `isWriteAllowed`, a
  non-datacenter ASN AND the slug is a published post page via ASSETS
  (`/blogg/<slug>/`, or `/en/blog/<slug>/` for an English-only post), so junk
  slugs mint no D1 rows. The slug is the view key (`lib/blog.ts viewKey`).
- `/api/geo` — GET, edge-cached 60 s. A failed D1 read is an uncached 503,
  never an empty map: `smoke.sh` and `status-watchdog.yml` probe D1 here.
- `/api/visit` — POST, the Besøk beacon: `recordGeo` writes the D1 `geo`
  row and the AE point (datacenter ASNs only to AE, as `bot`). GET is a
  harmless self-diagnostic (caller's country + whether it counts).
- `/api/timeseries?metric=view|geo&range=24h|7d|30d|all` — GET, edge-cached
  per metric+range (`all` ≈ 90 days at 6 h). No AE secrets or a failed AE
  read → 200, empty `points`, `degraded: true`, never cached; the watchdog
  fails on `degraded`.
- `/api/contact` — POST: a 32 KB body cap (413, by Content-Length and while
  reading), `isWriteAllowed` (403 `forbidden`), honeypot, the burst cap,
  Turnstile when `TURNSTILE_SECRET` is set (siteverify bounded at 5 s; its
  `hostname` must be the request's), an e-mail pattern without
  `<>,;"()[]\:` (it lands in `Reply-To`), D1 limits per sender (`contact.ip`
  holds `clientKey(ip)`) and per address, and a 2-minute dedup (same address
  + message → ack'd, no second mail).
- `/api/csp-report` — POST → always 204, AE only (anyone can POST): body via
  `readCapped` (64 KB); `parseCspReports` keeps own-origin reports (origin +
  path only) and a POST writes at most one point. GET → 405 (smoke-checked).
- `/.well-known/mta-sts.txt` — GET, any host (senders fetch it from
  `mta-sts.rozsoshnykh.no`, a custom domain). Proxies Cloudflare Email
  Routing's policy (`mta-sts.mx.cloudflare.net`, edge-cached 1 h) because
  our `_mta-sts` TXT is a CNAME to theirs — a copy in `public/` could name
  stale MX hosts and bounce mail under `mode: enforce`. Anything but a
  policy upstream → 503. The edge 301s every other path on that host
  (`zone-rules.yml`).
- A new `/api/*/<slug>` route goes into the WAF rule's exemptions
  (`.github/waf/scanner-block.expr`, like `/api/views/`): its word patterns
  would 403 a slug such as `jenkins-pipeline`; `check-waf` sees built pages
  only.

## Rules

- Two tsconfigs: `src/` checks under `tsconfig.worker.json` (types from the
  generated `worker-configuration.d.ts`: `npm run cf-typegen` after any
  `wrangler.jsonc` change or wrangler bump, enforced by `wrangler types
  --check`). `csp.ts`, `contact.ts`, `status.ts`, `metrics.ts`,
  `timeseries.ts` and `ip.ts` are also checked under the app tsconfig (tests
  and the app import them): DOM-compatible APIs only there.
- A Worker can't fetch its own public URL: the site goes through ASSETS (the
  `/api/views` slug check, `internal: true` monitors). Don't monitor the site
  itself — it serves the dashboard.
- `isWriteAllowed` is bot hygiene, NOT security (spoofable headers):
  anything with consequences has its own defence (contact: Turnstile + rate
  limits; views: the ASSETS slug check).
- Edge-cached endpoints key the cache on validated params only
  (`cachedApiJson(canonicalUrl)`) so junk query strings can't bypass it. A
  hit re-sets the stored TTL (`withStoredTtl`): the zone's Browser Cache TTL
  once rewrote `max-age` on HITs. `zone-rules.yml` now sets "Respect
  Existing Headers"; keep both, and keep clients on `cache: 'no-store'`.
- CSP: each page carries `metaCsp(hashes)` as a `<meta>` right after the
  charset, ahead of any script (`COMMON_DIRECTIVES` incl.
  `upgrade-insecure-requests`, minus `frame-ancestors`, plus `report-to` →
  `/api/csp-report`; only Chromium reports from `<meta>`). Every asset
  response also gets `HEADER_CSP` (`public/_headers` `/*`, equal by test):
  `frame-ancestors`/`object-src`/`base-uri`/`form-action` only — both
  policies apply, so a fetch directive there would block the hashed inline
  scripts. The Worker's JSON and redirects get `ENFORCED_CSP` (no
  `unsafe-inline`).
- Turn nothing on that makes the EDGE inject a script (JavaScript
  Detections, Rocket Loader, Zaraz, Web Analytics' automatic setup): the
  CSP refuses it and each refusal is a report, i.e. a Worker request.
  JavaScript Detections is off (`enable_js: false`, `zone-rules.yml`), Web
  Analytics is gone; `smoke.sh` ("no edge script") fails on an injected
  script. Turnstile's iframe logs `Refused to connect to 'data:,'` on the
  contact pages — Cloudflare's own iframe CSP, unreachable from ours and
  never reported; leave it (tested in `tests/csp.test.ts`). Trusted Types is
  off: Next 16's chunk loader assigns `script.src` a plain string (revisit
  when Next supports it).
- Only `/api/*` and the MTA-STS policy run the Worker (`run_worker_first`;
  keep the key — without it a navigation to `/api/status` gets the 404
  page). Pages, files and misses come from the asset server: free, past the
  100k/day quota too. Their headers come from `public/_headers` (security
  set on `/*`, `X-Frame-Options` on page paths, `immutable` on
  `/_next/static/*`, a week on stable files, PNG type on OG cards), which
  never applies to a Worker response — `tests/static-assets.test.ts` keeps
  it equal to `BASE_SECURITY_HEADERS` + HSTS + `HEADER_CSP` and no header in
  two rules (they'd join with a comma). A miss gets its path's `_headers`
  cache, which the `zone-rules.yml` rule turns into `no-store` on every
  4xx/5xx. HTML is `max-age=0, must-revalidate` with an ETag while the
  zone's HTML-rewriting features stay off. The zone's rate limiting rule
  excludes the static prefixes by hand (`docs/cloudflare-security.md`).
  `smoke.sh` canary: world.svg carries the week's cache AND no
  `X-Frame-Options` (served without the Worker).
- Status alerts are flap-damped (`CONSECUTIVE_FAILS_TO_ALERT = 2`): «nede»
  on the second failed probe in a row, «oppe igjen» on the first success
  after an alerted outage. `isStale`/`STALE_AFTER_MS` (20 min) grey out the
  banner and footer dot when the cron stops writing. `HISTORY_LIMIT = 149`
  is intentional (1:4:9).
- Contact: a failed mail send deletes its D1 row (else the dedup would ack
  the retry without mailing it). Windows over `contact.at` are ISO cutoffs
  from `isoCutoff()` bound as parameters — NEVER `datetime('now', …)`, which
  mis-compares with ISO as TEXT.
- `/en/` HTML: `scripts/finalize-export.mjs` rewrites `<html lang="nb">` to
  `en` under `out/en/` (smoke-checked); the 404 page gets `lang="en"` from
  the theme head script on a missing `/en/…` path.
- Slash-less paths: `out/_redirects` 301s every page (generated at build);
  anything else gets `html_handling`'s 307. `/favicon.ico` is a build-time
  copy of `/icons/favicon.ico`.
- Failures swallowed for availability (D1 upserts, mail sends, prune) still
  `console.error` — Workers Logs is the only place they show. Traces stay
  off (`"traces": {}` enables nothing; owner's call): from 2026-12-01 logs
  and traces share Free's 0.5 GB/day.

## Tests

- Route handlers, the entry's dispatch and both crons
  (`tests/worker/index.test.ts`) run under plain Vitest with in-process
  bindings from `tests/worker/fakes.ts`: D1 is REAL SQLite (`node:sqlite`,
  Node ≥ 22.5) loaded with `schema/metrics.sql`; KV, AE, Email Routing and
  ASSETS are fakes; `cloudflare:email` is aliased to a stub in
  `vitest.config.mts`. They type-check under `tsconfig.worker.json` (Node
  bits in `node-shims.d.ts`).
- A new endpoint or route behaviour gets a test there AND a
  `scripts/smoke.sh` check. The browser tests' stand-in answers
  (`e2e/api-stub.ts`) are held to the handlers by
  `tests/worker/api-stub.test.ts`: a route change that alters an answer
  updates the stub. Not `@cloudflare/vitest-pool-workers` (it pins an older
  wrangler and an alpha miniflare).
