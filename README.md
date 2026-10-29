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
- Font: Intel One Mono, self-hosted from Fontsource through `next/font/local`
  (`lib/fonts.ts`), so the build needs no network
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
secret-free build (lint → typecheck → test → build → `wrangler deploy
--dry-run` → `check:waf`, `check:dict`, `check:csp`) and a deploy job with the `production`
environment's secrets: sync runtime secrets (one `wrangler secret bulk`) →
`npx wrangler deploy` (the repo's pinned wrangler) → **`scripts/smoke.sh`**
against production (pages, APIs, redirects, security headers and the live
page CSPs, caching, noindex).
Push to live takes about 2 minutes. If the
smoke test fails, the job rolls the Worker back to the previous version (code
and pages) and fails loudly. `ci.yml` runs the same gate on PRs,
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
                    components/CLAUDE.md front end, src/CLAUDE.md worker,
                    .github/CLAUDE.md workflows)
lib/                blog.ts, tags.ts, markdown.ts, reading-time.ts, clipboard.ts,
                    stars.ts, fonts.ts (the self-hosted body font), site.ts
                    (name/roles/titles/colours per language),
                    metadata.ts (pageMetadata), i18n.ts + use-lang.ts (NO/EN
                    paths and language), blog-paths.ts, feed.ts (RSS per
                    language), og-site-card.tsx, og-post-card.tsx, og-fonts.ts
                    (Intel One Mono for the OG cards), geo.ts,
                    post-images.ts (post images: size, lazy, build checks),
                    status-fetch.ts (one shared /api/status fetch),
                    use-near-viewport.ts (below-the-fold widgets load on
                    approach), timeseries-fill.ts, trends-axis.ts, visit.ts
schema/             metrics.sql (views, geo, contact)
scripts/            smoke.sh, build-world-svg.mjs, finalize-export.mjs
                    (postbuild), check-csp.mjs, check-waf.mjs, check-docs.mjs
                    (docs drift), serve-out.mjs (out/ for the browser tests)
src/                Cloudflare Worker for /api/* + MTA-STS (index.ts, csp.ts, http.ts,
                    ip.ts, status.ts, metrics.ts, contact.ts, timeseries.ts,
                    routes/*)
tests/              Vitest
e2e/                Playwright browser tests (site.e2e.ts, fixtures.ts,
                    api-stub.ts: the Worker's answers, held to the route
                    handlers by tests/worker/api-stub.test.ts)
wrangler.jsonc      Worker config (ASSETS, STATUS KV, METRICS D1, METRICS_AE,
                    WRITE_LIMITER, CONTACT_EMAIL, crons, custom domains: apex,
                    www, mta-sts)
```

### How it works

The details, and the rules behind them, live in the agent docs: `CLAUDE.md`
(site-wide), `components/CLAUDE.md` (front-end internals), `src/CLAUDE.md`
(the Worker and its API), `.github/CLAUDE.md` (CI/CD and the ops workflows)
and `docs/cloudflare-security.md` (the zone) — kept in one place so they
can't drift apart here.

- **Uptime**: a 5-minute cron probes the services in `monitors()`
  (`src/status.ts`), keeps a rolling snapshot in KV and mails flap-damped
  «nede» / «oppe igjen» alerts. The front page's status section shows it and
  greys out when the cron itself goes quiet; an hourly GitHub workflow
  watches the watcher.
- **Visits**: one beacon per browser per day, sent on the first human input
  and never from an automated browser (`lib/visit.ts`), counts the country
  in D1 (the world map) and a timestamped point in Analytics Engine (the
  Trends chart). Post views count the same way. No cookies, no IP addresses
  in the statistics.
- **Contact form** (`/kontakt`): Cloudflare Turnstile, a honeypot, header
  gates, a per-client burst cap and D1 rate limits ahead of Email Routing;
  the stored copy is pruned after 30 days.
- **Security**: a hash-based CSP baked into every page at build, HSTS
  preload, a scanner-blocking WAF rule and rate limiting at the edge,
  DNSSEC, DMARC `p=reject` and MTA-STS. Pages never depend on the Worker, so
  a spent request quota can't take them down.

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
