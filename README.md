## rozsoshnykh.no

Personal site and blog for **Dmytro Rozsoshnykh** — sysadmin / DevOps in Vestland, Norway.
A static Next.js export served by Cloudflare Workers static assets, with a
Worker for `/api/*` that runs uptime monitoring, visitor geo aggregation,
per-post view counters and a contact form.
Site copy is Norwegian (`nb-NO`) at the root with an English twin under
`/en/` (front page, contact, privacy, blog); code and docs are English.

Live: https://rozsoshnykh.no

### Stack

- Next.js 16 (App Router, `output: 'export'`) + React 19, TypeScript 6, Tailwind v4
- Content: markdown posts in `content/blog/` (gray-matter + react-markdown +
  remark-gfm + rehype-highlight for code blocks)
- Hosting: Cloudflare Workers + Static Assets (binding `ASSETS`), KV (`STATUS`),
  D1 (`METRICS`), Analytics Engine (`METRICS_AE`), a rate-limiting binding
  (`WRITE_LIMITER`, 20 writes/min per address), Email Routing
  (`CONTACT_EMAIL`), Turnstile on the contact form, crons `*/5 * * * *`
  (uptime) and `0 3 * * *` (daily prune of the contact table, 30-day window)
- Pages never touch the Worker: each carries its strict hash CSP as a
  `<meta>` baked in at build (`scripts/finalize-export.mjs`, re-checked by
  `scripts/check-csp.mjs`), headers come from `public/_headers`, redirects
  from `public/_redirects` + the zone (www → apex, HTTP → HTTPS)
- Worker (`src/`) handles the `/api/*` endpoints, the crons and the MTA-STS
  policy on `mta-sts.rozsoshnykh.no` (Cloudflare Email Routing's, proxied)

### Scripts

| | |
|--|--|
| `npm run dev` | Next dev server with Turbopack |
| `npm run build` | `prebuild` emits `public/world.svg`, then static export to `out/`, then `postbuild` (`scripts/finalize-export.mjs`): each page's hash CSP `<meta>`, `lang="en"`, `/favicon.ico`, slash-less 301s |
| `npm run check:waf` / `check:csp` | After a build: the WAF rule blocks no served URL (`scripts/check-waf.mjs`); every inline script is hashed in its page's CSP (`scripts/check-csp.mjs`) |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |
| `npm run typecheck` | `wrangler types --check` (`cf-typecheck`: is `worker-configuration.d.ts` current?), then `tsc --noEmit` for app **and** worker (`tsconfig.worker.json`) |
| `npm test` | Vitest — CSP hashing + violation-report parsing, status history + alert damping + staleness, tags, metrics, contact, reading time, page metadata, map buckets, time-series (epoch boundary, AE parsing, bucket fill), and the Worker route handlers (`tests/worker/`, D1 as real SQLite) |
| `npm run test:e2e` | After a build: Playwright browser tests (`e2e/`, `playwright.config.ts`) on `out/` served by `scripts/serve-out.mjs`, `/api/*` stubbed — user flows, axe in both themes, no console error or CSP violation (CI runs them) |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run deploy` | Manual path: `predeploy` (lint + typecheck + test) → build → `wrangler deploy` |

### CI/CD

Push to `main` triggers `.github/workflows/deploy.yml`, two jobs: a
secret-free build (lint → typecheck → test → build → `check:waf`,
`check:dict`, `check:csp`) and a deploy job with the `production`
environment's secrets: sync runtime secrets (one `wrangler secret bulk`) →
`npx wrangler deploy` (the repo's pinned wrangler) → **`scripts/smoke.sh`**
against production (pages, APIs, redirects, security headers and the live
page CSPs, caching, noindex).
Push to live takes about 2 minutes. If the
smoke test fails, the deploy fails loudly. `ci.yml` runs the same gate on PRs,
plus the Playwright browser tests (desktop and mobile Chromium, an iPhone in
WebKit), as the `check` status check (~4 minutes).

Merging is **hands-off**: `main` is branch-protected to require `check` with 0
approvals (solo repo — you can't approve your own PR). PRs go up ready (not
draft) with **squash auto-merge** enabled, so a green `check` merges them
automatically — which triggers the deploy above — and GitHub then deletes the
merged head branch. A failing `check` just leaves the PR open with auto-merge
pending; open a draft (and skip auto-merge) to hold a change for manual review.

Monitoring workflows: `status-watchdog` (scheduled hourly, but GitHub runs
it only every 2–8 hours — measured in October 2026; fails, and GitHub
e-mails, when the site is down, the status snapshot is older than 25 minutes,
the D1 database fails a read or the Analytics Engine read is degraded three
runs in a row) and
`analytics-report` (manual; Analytics Engine breakdown of visits by network
and country, plus browser-reported CSP violations, in the run summary).

One-shot maintenance workflows (manual `workflow_dispatch`): `d1-bootstrap`
(create the D1 + apply schema), `d1-repair` (info probe / Time Travel restore
/ recreate / create / one-off `sql` statement — built for the 2026-07-03 D1
storage outage),
`reset-metrics` (type `RESET` to wipe the `views` + `geo` counters, prints
before/after counts — supersedes the older geo-only `geo-reset`). There is no
off-platform backup: Cloudflare's built-in D1 Time Travel (7 days on Workers
Free) is the only restore path — an accepted risk, since the counters are cosmetic and contact
submissions are delivered by e-mail anyway (the D1 row is a secondary copy).
A weekly encrypted-dump workflow existed briefly and was removed as not worth
the upkeep.

Secrets live in the GitHub environment `production` (deployment branches:
`main` only; no repository-level secrets — `.github/CLAUDE.md`):
`CLOUDFLARE_API_TOKEN` (deploy: Workers, KV, D1), `CLOUDFLARE_ZONE_TOKEN`
(zone settings and rules, `zone-rules.yml` only), `CLOUDFLARE_ACCOUNT_ID`,
`TURNSTILE_SECRET`, `NETBOX_URL` (the uptime cron's NetBox URL), `AE_API_TOKEN` (Account Analytics:Read
token for the Analytics Engine SQL API; `CF_ACCOUNT_ID` for the same call
reuses `CLOUDFLARE_ACCOUNT_ID`). The public Turnstile site key is a repository
variable, `TURNSTILE_SITE_KEY`, read only by the secret-free build job.

### Layout

```
.claude/            Claude Code project config: skills (audit, browser-check,
                    new-post), hooks (session-start.sh: npm ci; guard-bash.mjs:
                    no shell reads of generated files; stop-docs.mjs: doc-drift
                    gate before a session ends), permissions allowlist
app/                Next App Router: home, /blogg, /blogg/tag/[slug], /kontakt,
                    /personvern, en/ (English home, contact, privacy, blog,
                    feed and OG cards), feed.xml, sitemap, robots, manifest, OG
                    images, icons/[name] (PNG icons), error boundaries,
                    template.tsx (opacity route cross-fade)
components/         React components (Hero, Skills, StatusDashboard, GeoMap,
                    HalIdle, ContactForm, Turnstile, …)
content/blog/       Markdown posts (frontmatter: title, description, date, tags);
                    English twins in content/blog/en/ (translationOf)
context/            ThemeContext (light/dark with no FOUC)
data/               Skills, certifications, tag canon + aliases (tags.ts), UI
                    copy in both languages (i18n.ts; the error boundary's in
                    i18n-error.ts)
docs/               history.md — incident history, the "why" behind CLAUDE.md's
                    hard rules; cloudflare-security.md — the zone's edge
                    security on the Free plan (agent docs: CLAUDE.md sitewide,
                    src/CLAUDE.md worker, .github/CLAUDE.md workflows)
lib/                blog.ts, tags.ts, markdown.ts, reading-time.ts, clipboard.ts,
                    stars.ts, site.ts (name/roles/titles/colours per language),
                    metadata.ts (pageMetadata), i18n.ts + use-lang.ts (NO/EN
                    paths and language), blog-paths.ts, feed.ts (RSS per
                    language), og-site-card.tsx, og-post-card.tsx, geo.ts,
                    post-images.ts (post images: size, lazy, build checks),
                    status-fetch.ts (one shared /api/status fetch),
                    timeseries-fill.ts, trends-axis.ts, visit.ts
schema/             metrics.sql (views, geo, contact)
scripts/            smoke.sh, build-world-svg.mjs, finalize-export.mjs
                    (postbuild), check-csp.mjs, check-waf.mjs, check-docs.mjs
                    (docs drift), serve-out.mjs (out/ for the browser tests)
src/                Cloudflare Worker for /api/* + MTA-STS (index.ts, csp.ts, http.ts,
                    ip.ts, status.ts, metrics.ts, contact.ts, timeseries.ts,
                    routes/*)
tests/              Vitest
e2e/                Playwright browser tests (site.e2e.ts, fixtures.ts)
wrangler.jsonc      Worker config (ASSETS, STATUS KV, METRICS D1, METRICS_AE,
                    WRITE_LIMITER, CONTACT_EMAIL, crons, custom domains: apex,
                    www, mta-sts)
```

### Uptime monitoring

The cron pings every entry of `monitors()` (`src/status.ts`) every 5 minutes and
writes a JSON snapshot to KV (`status` key). `/api/status` serves the snapshot
(edge-cached 60 s — well under the cron interval, so refreshes still land
promptly while KV reads stay near zero); the front page (`/#status`) renders
it with per-service history, capped at `HISTORY_LIMIT` (149 ≈ 12.5h — the
monolith's 1:4:9 proportions). The dashboard polls adaptively: 90s when all
is up, 30s during an incident. The public snapshot carries monitor names
only, no URLs. A snapshot older than 20 minutes (the cron itself stopped)
turns the banner and the footer dot grey ("Statusdata er utdatert") instead
of repeating the last known state.

Add a service by extending `monitors()`. Use `internal: true` for routes that
point at this site itself (the ASSETS binding is required — Workers block
self-fetches over the public URL). A check counts as up only on a final HTTP
200 (redirects followed).

State-change alerts go out by e-mail and are flap-damped: «nede» is sent only
after two consecutive failed probes (a single 5-minute blip stays silent),
«oppe igjen» on the first success after an alerted outage.

### Metrics

Counters live in a D1 database (`rozsoshnykh-metrics-v2`, schema in
`schema/metrics.sql`) with atomic upserts — no read-modify-write races and a
100k writes/day free budget. KV holds only the uptime snapshot.

- **Per-post views**: `GET/POST /api/views/<slug>`. Counted once per browser
  session from the post page, on the first human input (never on load alone,
  never from an automated browser — like the visit beacon); bot UAs,
  datacenter networks and cross-origin POSTs are ignored, and a POST only
  counts if the slug resolves to a published post page (checked against the
  static export via the ASSETS binding), so spoofed headers can't mint junk
  rows in D1. Both language versions of a post share one counter.
- **Visitors by country**: every page mounts a tiny `VisitBeacon` that fires
  a single `POST /api/visit` per browser per day (a localStorage date, so
  several pages, tabs or a return that day count as one besøk), and only on
  the first human input — never on load alone, never from an automated
  browser (`lib/visit.ts`). The Worker reads
  `request.cf.country` on that one POST and upserts `geo` in D1.
  `GET /api/geo` feeds the world map on the front page (a build-time
  `public/world.svg`, not a JS bundle) and is edge-cached for 60s. No
  cookies, no per-visitor tracking. The country legend renders flag emoji
  through a self-hosted Twemoji subset (`public/fonts/`, `@font-face` with a
  regional-indicator `unicode-range` so it only downloads when a flag is on
  the page) — Windows/Linux without flag glyphs would otherwise show letter
  pairs.
- **Reading time** is computed from markdown (~200 wpm, fenced code excluded).
- **Time-series** of visits lives in a Workers Analytics Engine dataset
  (`rozsoshnykh_metrics`, binding `METRICS_AE`). The `/api/visit` beacon
  appends one AE point per counted visit (country plus the network's ASN and
  operator name — a bot diagnostic, never stored in D1, no IP); `GET /api/timeseries?metric=geo&range=24h|7d|30d|all`
  reads them back via the AE SQL API and feeds the front-page **Trends**
  card (dot plot over a zero-filled bucket grid). The windowed tabs
  (24t/7d/30d) show the AE count for their window; the **Alt** (all-time)
  tab shows the exact D1 total — the same number as the map — so the grand
  total never drifts from the map under AE sampling. Only Besøk is graphed
  even though the API still accepts the `view` channel. Free tier: 100,000
  data points written and 10,000 read queries per day, 3 months' retention;
  reads are sampled. Reading needs two runtime secrets
  (`CF_ACCOUNT_ID` + `AE_API_TOKEN`, the latter with `Account
  Analytics:Read`); without them the route degrades to an empty series
  and the Trends card shows "Ingen data ennå". AE is append-only —
  counters reset via `reset-metrics` (D1), and `METRICS_EPOCH` in
  `src/timeseries.ts` filters out pre-relaunch AE points client-side
  (bump it after every reset run).

### Contact form (`/kontakt`)

`POST /api/contact` → validate → Cloudflare Turnstile → store in D1 (`contact`,
also a backup copy) → send via Email Routing (`contact@rozsoshnykh.no`, Reply-To
the sender). Defence in depth: a 32 KB body cap + same-origin check + bot-UA
filter + off-screen honeypot + a per-address burst cap (`WRITE_LIMITER`) +
Turnstile + per-IP rate limit (3 / 10 min; IPv6 by /64) + per-email rate limit
(2 / hour, catches IP-rotating spammers reusing a throwaway address) + short-
window dedup (identical address + message within 2 min is ack'd without a
second mail). All windows are exact: ISO cutoffs against the ISO `at`
column. Both rate-limit windows query D1; a daily cron prunes the table
to a 30-day window. If the mail leg fails, the row is deleted again and the
form reports the error with its text intact, so a retry is a fresh
submission (not a silently ack'd duplicate). Turnstile tokens are
single-use: the form resets the widget after every non-OK response.

Turnstile is feature-gated: the widget renders only when `TURNSTILE_SITE_KEY`
is set, and the worker enforces it only when `TURNSTILE_SECRET` is set. With
neither, the form works on its other defences; a secret without a site key
refuses every submission, so `deploy.yml` fails on an empty site key.

### Manual deploy

Requires `wrangler login` and the KV/D1 bindings in `wrangler.jsonc` (or your
own ids). Then `npm run deploy` — `predeploy` runs lint/typecheck/test first.

### Status (soft launch)

The site is live at `rozsoshnykh.no` (`www` and plain HTTP 301 at the edge;
the `workers.dev` subdomain and preview URLs are off). DNSSEC is active, HSTS
is on the browsers' preload list, TLS 1.3 only; mail to the domain has
MTA-STS (`enforce`), TLS-RPT and DMARC `p=reject` (checked 2026-10-23). `robots: { index: false }` stays
until the first posts are published — flip `robots.index` to `true` in
`app/layout.tsx` and submit the sitemap in Google Search Console then.
