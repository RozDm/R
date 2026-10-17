# Workflows (.github/)

Loaded when working under `.github/`. Site-wide rules: root `CLAUDE.md`;
incident background: `docs/history.md`.

- `ci.yml` — job `check` on PRs: lint, typecheck (starting with
  `wrangler types --check`), test, build, then `check:dict` (the UI
  dictionary sits in exactly one chunk — `turbopackChunking`, CLAUDE.md
  Gotchas) and `check:waf` (`scripts/check-waf.mjs`: the WAF expression
  must block no URL in `out/` and still block its scanner list). It is the one
  required status check on `main`, so its result decides the auto-merge.
- `deploy.yml` — on push to `main`: the same checks → build → check:waf → one
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
  not the site — e.g. Bot Fight Mode, which challenges GitHub's cloud
  runners and can't be excepted on Free; it is off for that reason
  (`docs/cloudflare-security.md`). A `429` is the zone's rate limiting rule
  (60/10 s per IP). GitHub disables
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
  Applied 2026-10-16. It also sets `enable_js: false` on
  `/zones/{id}/bot_management` (JavaScript Detections: an edge-injected
  inline loader the hash CSP refuses, one CSP report per page view; it
  outlived Bot Fight Mode — `docs/cloudflare-security.md` lesson 3) and
  `ai_bots_protection: disabled` (the deprecated "Block AI bots" toggle,
  whose block now also stops Googlebot; the AI bot policies' Training
  "disallow" keeps the training crawlers out — the prod check probes GPTBot), failing
  if the PUT moved any other field or if a dashboard bot setting would
  block search engines or CI (Bot Fight Mode, AI Training/Search "block",
  AI Labyrinth…); sets the zone settings (Browser Cache TTL "Respect
  Existing Headers", 0-RTT on, minimum TLS raised to 1.2 if lower); and
  applies the "Block scanners" WAF rule from `.github/waf/scanner-block.expr`
  — dry run first, then a PATCH of that one rule in place (found by ref,
  else by name; the old expression is printed for a rollback; other custom
  rules are never touched). The prod check then wants `/` free of the
  `/cdn-cgi/challenge-platform/` loader, TLS 1.1 refused, a GPTBot UA
  blocked, scanner paths
  answered by Cloudflare's 403 and scanner-word slugs by the Worker. The
  token (a user-owned one, My Profile → API Tokens; the run prints its id)
  needs Zone: Read + Zone → Transform Rules: Edit + Zone → Bot Management:
  Edit + Zone → Zone Settings: Edit + Zone → Zone WAF: Edit — enough in
  practice; the Account Rulesets: Read some docs list wasn't.
- `d1-bootstrap.yml` — one-shot: creates the metrics D1 (skipped when the
  name is already listed) and applies the schema.
- `dependabot.yml` — weekly (Monday, Europe/Oslo, 7-day cooldown) grouped
  PRs: npm minor+patch in one, wrangler alone, GitHub Actions in one; every
  semver-major is ignored (migrations are done by hand — ESLint stays 9).
  Dependabot PRs get no repo secrets, which `check` doesn't need. Merge one
  by enabling squash auto-merge as the owner, so the merge push is the
  owner's and `deploy.yml` runs with its secrets (never a GITHUB_TOKEN merge
  workflow). The wrangler PR stays red until `npm run cf-typegen` is
  committed on it (`wrangler types --check` compares the workerd version);
  pushing to a Dependabot branch stops Dependabot rebasing it.
- Every workflow runs with a read-only `GITHUB_TOKEN`; Cloudflare access comes
  from the `CLOUDFLARE_API_TOKEN` secret.
