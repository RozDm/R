# Workflows (.github/)

Loaded when working under `.github/`. Site-wide rules: root `CLAUDE.md`;
incident background: `docs/history.md`.

- `ci.yml` — job `check` on PRs: lint, typecheck, test, build. It is the one
  required status check on `main`, so its result decides the auto-merge.
- `deploy.yml` — on push to `main`: the same checks → build → one
  `wrangler secret bulk` syncing `TURNSTILE_SECRET`, `CF_ACCOUNT_ID` and
  `AE_API_TOKEN` from GitHub secrets (unset ones are skipped, never blanked)
  → `npx wrangler deploy` with the repo's pinned wrangler (not
  `cloudflare/wrangler-action`, which runs on deprecated Node 20) →
  `scripts/smoke.sh` against the live site. The `TURNSTILE_SITE_KEY` secret
  is inlined into the build as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- `status-watchdog.yml` — hourly, outside Cloudflare: fails (GitHub e-mails
  the owner) when the site is down or `/api/status` is older than 20 min —
  the one failure the Worker can't report about itself. A `403` here (or in
  `smoke.sh`) whose page says `X-Frame-Options: SAMEORIGIN` is Cloudflare,
  not the site: Bot Fight Mode challenges GitHub's cloud runners and can't
  be excepted on Free (`docs/cloudflare-security.md`). GitHub disables
  scheduled workflows after 60 days without repo activity; re-enable it from
  the Actions tab.
- `analytics-report.yml` — manual, `days` 1–90, read-only: AE breakdowns in
  the run summary — Besøk by ASN/operator and country, and the CSP
  violations browsers reported. The tables are also teed to the job log, so
  an agent can read them with `get_job_logs` (summaries have no API).
- `reset-metrics.yml` — manual, type `RESET` to confirm: wipes the D1
  `views` + `geo` counters and prints before/after counts. AE can't be reset
  (append-only), so bump `METRICS_EPOCH` in `src/timeseries.ts` after every
  run (6-hour UTC boundary, rounded up).
- `d1-repair.yml` — manual surgery kit from the D1 incident: `info`
  (read-only probe), `restore` (Time Travel to a timestamp), `create` (no
  existence check — for a ghost-locked name), `recreate` (delete + create,
  type RECREATE; the new database_id must then go into `wrangler.jsonc` +
  `npm run cf-typegen`), `sql` (one statement — for surgical fixes where
  reset-metrics is too blunt).
- `zone-rules.yml` — manual, idempotent: applies the zone's Response Header
  Transform Rule `error_no_store` (`Cache-Control: no-store` when
  `http.response.code ge 400`; `ge 400`, never `ne 200`, or 304s would strip
  the cached chunks' `immutable`), then checks prod: a static miss is 404 +
  no-store, a real chunk and its 304 stay immutable. `public/_headers` can't
  match on status, so this is what keeps a deploy-race 404 under the
  asset-first paths from being browser-cached for a year. `smoke.sh` checks
  it on every deploy (a static miss is no-store, a real chunk immutable).
  Applied 2026-10-16. The token (a user-owned one, My Profile → API Tokens;
  the run prints its id) needs Zone: Read + Zone → Transform Rules: Edit —
  enough in practice; the Account Rulesets: Read some docs list wasn't.
- `d1-bootstrap.yml` — one-shot: creates the metrics D1 (skipped when the
  name is already listed) and applies the schema.
- Every workflow runs with a read-only `GITHUB_TOKEN`; Cloudflare access comes
  from the `CLOUDFLARE_API_TOKEN` secret.
