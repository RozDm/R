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
  the one failure the Worker can't report about itself. GitHub disables
  scheduled workflows after 60 days without repo activity; re-enable it from
  the Actions tab.
- `analytics-report.yml` — manual, `days` 1–90, read-only: AE breakdowns in
  the run summary — Besøk by ASN/operator and country, and the CSP
  violations browsers reported.
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
- `d1-bootstrap.yml` — one-shot: creates the metrics D1 (skipped when the
  name is already listed) and applies the schema.
- Every workflow runs with a read-only `GITHUB_TOKEN`; Cloudflare access comes
  from the `CLOUDFLARE_API_TOKEN` secret.
