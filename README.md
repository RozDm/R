## rozsoshnykh.no

Personal site and blog for **Dmytro Rozsoshnykh** — sysadmin / DevOps in Vestland, Norway.
A static Next.js export served by a Cloudflare Worker that also runs uptime
monitoring, visitor geo aggregation, per-post view counters and a contact form.
Site copy is Norwegian (`nb-NO`); code and docs are English.

Live: https://rozsoshnykh.no

### Stack

- Next.js 16 (App Router, `output: 'export'`) + React 19, TypeScript 6, Tailwind v4
- Content: markdown posts in `content/blog/` (gray-matter + react-markdown +
  remark-gfm + rehype-highlight for code blocks)
- Hosting: Cloudflare Workers + Static Assets (binding `ASSETS`), KV (`STATUS`),
  D1 (`METRICS`), Email Routing (`CONTACT_EMAIL`), crons `*/5 * * * *` (uptime)
  and `0 3 * * *` (daily prune of the contact table, 30-day window)
- Worker (`src/`) handles canonical host (301 from `www` and `*.workers.dev`),
  strict per-request hash CSP for HTML it can decode, security headers, and the
  `/api/*` endpoints

### Scripts

| | |
|--|--|
| `npm run dev` | Next dev server with Turbopack |
| `npm run build` | `prebuild` emits `public/world.svg`, then static export to `out/` |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |
| `npm run typecheck` | `tsc --noEmit` for app **and** worker (`tsconfig.worker.json`) |
| `npm test` | Vitest — CSP hashing, status history, tags, metrics, contact, reading time |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run deploy` | Manual path: `predeploy` (lint + typecheck + test) → build → `wrangler deploy` |

### CI/CD

Push to `main` triggers `.github/workflows/deploy.yml`: lint → typecheck → test →
build → push the Turnstile secret → `wrangler deploy` → **`scripts/smoke.sh`**
against production (pages, APIs, redirects, security headers, noindex). If the
smoke test fails, the deploy fails loudly. `ci.yml` runs the same gate on PRs as
the `check` status check.

Merging is **hands-off**: `main` is branch-protected to require `check` with 0
approvals (solo repo — you can't approve your own PR). PRs go up ready (not
draft) with **squash auto-merge** enabled, so a green `check` merges them
automatically — which triggers the deploy above — and GitHub then deletes the
merged head branch. A failing `check` just leaves the PR open with auto-merge
pending; open a draft (and skip auto-merge) to hold a change for manual review.

One-shot maintenance workflows (manual `workflow_dispatch`): `d1-bootstrap`
(create the D1 + apply schema), `d1-repair` (info probe / Time Travel restore
/ recreate / create — built for the 2026-07-03 D1 storage outage),
`reset-metrics` (type `RESET` to wipe the `views` + `geo` counters, prints
before/after counts — supersedes the older geo-only `geo-reset`). There is no
off-platform backup: Cloudflare's built-in 30-day D1 Time Travel is the only
restore path — an accepted risk, since the counters are cosmetic and contact
submissions are delivered by e-mail anyway (the D1 row is a secondary copy).
A weekly encrypted-dump workflow existed briefly and was removed as not worth
the upkeep.

Repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `AE_API_TOKEN` (Account Analytics:Read
token for the Analytics Engine SQL API; `CF_ACCOUNT_ID` for the same call
reuses `CLOUDFLARE_ACCOUNT_ID`).

### Layout

```
app/                Next App Router: home, /blogg, /blogg/tag/[slug], /kontakt,
                    feed.xml, sitemap, robots, manifest, OG images, error
                    boundaries, template.tsx (opacity route cross-fade)
components/         React components (Hero, Skills, StatusDashboard, GeoMap,
                    HalIdle, ContactForm, Turnstile, …)
content/blog/       Markdown posts (frontmatter: title, description, date, tags)
context/            ThemeContext (light/dark with no FOUC)
data/               Skills, certifications, and tag canon + aliases (tags.ts)
lib/                blog.ts, tags.ts, reading-time.ts, clipboard.ts, stars.ts, site.ts
schema/             metrics.sql (views, geo, contact + dormant subscribers)
scripts/            smoke.sh, build-world-svg.mjs
src/                Cloudflare Worker (index.ts, csp.ts, http.ts, status.ts,
                    metrics.ts, contact.ts, timeseries.ts, routes/*)
tests/              Vitest
wrangler.jsonc      Worker config (ASSETS, STATUS KV, METRICS D1, CONTACT_EMAIL, cron, routes)
```

### Uptime monitoring

The cron pings every entry in `MONITORS` (`src/status.ts`) every 5 minutes and
writes a JSON snapshot to KV (`status` key). `/api/status` serves the snapshot
(edge-cached 60 s — well under the cron interval, so refreshes still land
promptly while KV reads stay near zero); the front page (`/#status`) renders
it with per-service history, capped at `HISTORY_LIMIT` (149 ≈ 12.5h — the
monolith's 1:4:9 proportions). The dashboard polls adaptively: 90s when all
is up, 30s during an incident.

Add a service by extending `MONITORS`. Use `internal: true` for routes that
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
  session from the post page; bot UAs and cross-origin POSTs are ignored, and
  a POST only counts if the slug resolves to a published post page (checked
  against the static export via the ASSETS binding), so spoofed headers can't
  mint junk rows in D1.
- **Visitors by country**: every page mounts a tiny `VisitBeacon` that fires
  a single `POST /api/visit` per browser session (sessionStorage-deduped, so
  clicking through several pages counts as one besøk). The Worker reads
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
  (`METRICS_AE`, binding `rozsoshnykh_metrics`). The `/api/visit` beacon
  appends one AE point per session; `GET /api/timeseries?metric=geo&range=24h|7d|30d|all`
  reads them back via the AE SQL API and feeds the front-page **Trends**
  card (dot plot over a zero-filled bucket grid). The windowed tabs
  (24t/7d/30d) show the AE count for their window; the **Alt** (all-time)
  tab shows the exact D1 total — the same number as the map — so the grand
  total never drifts from the map under AE sampling. Only Besøk is graphed
  even though the API still accepts the `view` channel. Free tier: 10M
  writes/day, sampled reads. Reading needs two runtime secrets
  (`CF_ACCOUNT_ID` + `AE_API_TOKEN`, the latter with `Account
  Analytics:Read`); without them the route degrades to an empty series
  and the Trends card shows "Ingen data ennå". AE is append-only —
  counters reset via `reset-metrics` (D1), and `METRICS_EPOCH` in
  `src/timeseries.ts` filters out pre-relaunch AE points client-side
  (bump it after every reset run).

### Contact form (`/kontakt`)

`POST /api/contact` → validate → Cloudflare Turnstile → store in D1 (`contact`,
also a backup copy) → send via Email Routing (`contact@rozsoshnykh.no`, Reply-To
the sender). Defence in depth: Turnstile + same-origin check + bot-UA filter +
off-screen honeypot + per-IP rate limit (3 / 10 min) + per-email rate limit
(2 / hour, catches IP-rotating spammers reusing a throwaway address) + short-
window dedup (identical address + message within 2 min is ack'd without a
second mail). Both rate-limit windows query D1; a daily cron prunes the table
to a 30-day window.

Turnstile is feature-gated: the widget renders only when `TURNSTILE_SITE_KEY`
is set, and the worker enforces it only when `TURNSTILE_SECRET` is set, so the
form keeps working without keys.

### Manual deploy

Requires `wrangler login` and the KV/D1 bindings in `wrangler.jsonc` (or your
own ids). Then `npm run deploy` — `predeploy` runs lint/typecheck/test first.

### Status (soft launch)

The site is live at `rozsoshnykh.no` (with 301 from `www` and
`d.rozsoshnykh.workers.dev`). DNSSEC is active. `robots: { index: false }` stays
until the first posts are published — flip `robots.index` to `true` in
`app/layout.tsx` and submit the sitemap in Google Search Console then.
