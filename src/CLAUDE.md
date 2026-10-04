# Worker notes (src/)

Rules that only matter when editing the Worker. The site-wide map lives in the
root `CLAUDE.md`; incident background in `docs/history.md`.

- Two tsconfigs: `src/` type-checks under `tsconfig.worker.json` (Workers
  runtime types from the generated `worker-configuration.d.ts` — regenerate
  with `npm run cf-typegen` after any `wrangler.jsonc` change and commit it).
  BUT `csp.ts`, `contact.ts`, `status.ts`, `metrics.ts` and `timeseries.ts`
  are ALSO checked under the app tsconfig because tests import them — and
  the app itself imports `status.ts` (`isStale`, `HISTORY_LIMIT`) and
  `timeseries.ts` (`METRICS_EPOCH`, `normalizeBucketKey`). DOM-compatible
  APIs only in those five files, no Workers-only globals.
- A Worker cannot fetch its own public URL (Cloudflare blocks the loop).
  Anything that needs the site itself goes through the ASSETS binding: the
  `/api/views` slug-existence check, and `internal: true` monitors (supported
  by the cron, none configured today). Don't
  monitor the site itself — the dashboard is served by it.
- Route handlers (`src/routes/*`) take the parsed `URL` and return `null` when
  the path isn't theirs; `index.ts` chains them with `??`. Route handlers are
  tested in `tests/worker/` with in-process fakes (real SQLite for D1 —
  see the root CLAUDE.md Gotchas); new endpoints get a test there AND a
  `scripts/smoke.sh` check. Pure logic still goes in a top-level `src/*.ts`
  module.
- The write gates (`isWriteAllowed`: Sec-Fetch-Site + UA filter) are bot
  hygiene, NOT security — the headers are trivially spoofable. Anything with
  real consequences needs its own defence: contact has Turnstile + rate
  limits; views POST requires the slug to resolve to a published page via
  ASSETS before it may create a D1 row.
- Edge-cached JSON endpoints build cache keys from validated params only
  (`cachedApiJson(canonicalUrl)` in `http.ts`) — junk query strings must not
  fragment (and thereby bypass) the cache.
- Status alerts are flap-damped (`CONSECUTIVE_FAILS_TO_ALERT = 2` in
  `status.ts`): «nede» mails only on the second consecutive failed probe,
  «oppe igjen» on the first success after an alerted outage — a one-tick blip
  never mails in either direction.
- Every Analytics Engine SQL `INTERVAL` literal is quoted
  (`INTERVAL '6' HOUR`) — AE's parser 422s on the bare `INTERVAL 6 HOUR`.
- `METRICS_EPOCH` must sit on a 6-hour UTC boundary (00/06/12/18) —
  unit-tested in `tests/timeseries.test.ts`. Bump it after every
  `reset-metrics` run, rounding UP to the next boundary (why: docs/history.md).
- KV free tier is 1000 writes/day: only the 5-minute cron writes the status
  snapshot. Never add a per-request KV write; per-request counters go to D1
  (100k writes/day) or AE (10M points/day).
- `HISTORY_LIMIT = 149` is the monolith's 1:4:9 — intentional, don't "fix" it.
- `/api/status` is public: `buildStatusData` strips monitor URLs from the KV
  snapshot (`PublicMonitorResult`). Don't put them back — one monitor is an
  admin login page. Alerts get the URL from the cron's own probe results.
- Contact: a failed mail send must delete its D1 row (the 2-minute content
  dedup would otherwise ack the visitor's retry without mailing it). Time
  windows over `contact.at` (ISO strings) are ISO cutoffs from
  `isoCutoff()` bound as parameters — never `datetime('now', …)`, whose
  "YYYY-MM-DD HH:MM:SS" form mis-compares with ISO as TEXT.
- Failures that are swallowed for availability (D1 upserts, mail sends,
  prune) still `console.error` — Workers Logs is the only place they show.
- `/api/csp-report` writes AE only and always answers 204 to POST; it must
  never touch D1/KV (anyone can POST to it).
