## rozsoshnykh.no

Personal site and blog for **Dmytro Rozsoshnykh** — sysadmin / DevOps in Vestland, Norway.
Next.js static export served by a Cloudflare Worker that also runs uptime monitoring,
visitor geo aggregation and per-post view counters from KV. Site copy is Norwegian
(`nb-NO`); code and docs are English.

Live: https://rozsoshnykh.no

### Stack

- Next.js 15 (App Router, `output: 'export'`) + React 19, TypeScript, Tailwind v4
- Content: markdown posts in `content/blog/` (gray-matter + react-markdown + remark-gfm)
- Hosting: Cloudflare Workers + Static Assets (binding `ASSETS`), KV (binding `STATUS`),
  cron `*/5 * * * *`
- Worker (`src/`) handles canonical host (301 from `www` and `*.workers.dev`),
  strict per-request hash CSP for HTML it can decode, security headers and the
  `/api/*` endpoints

### Scripts

| | |
|--|--|
| `npm run dev` | Next dev server with Turbopack |
| `npm run build` | Static export to `out/` |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |
| `npm run typecheck` | `tsc --noEmit` for app **and** worker (`tsconfig.worker.json`) |
| `npm test` | Vitest — CSP hashing, status history, tags, metrics, reading time |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm run deploy` | Manual path: `predeploy` (lint + typecheck + test) → build → `wrangler deploy` |

### CI/CD

Push to `main` triggers `.github/workflows/deploy.yml`: lint → typecheck → test →
build → `wrangler deploy` → **`scripts/smoke.sh`** against production (pages, APIs,
redirects, security headers). If the smoke test fails, the deploy fails loudly.
`ci.yml` runs the same gate on pull requests.

Repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

### Layout

```
app/                Next App Router: home, /blogg, feed.xml, sitemap, robots, OG images
components/         React components (Hero, Skills, StatusDashboard, GeoMap, HalIdle, …)
content/blog/       Markdown posts (frontmatter: title, description, date, tags)
context/            ThemeContext (light/dark with no FOUC)
data/               Skills and certifications
lib/                blog.ts, tags.ts (alias normalisation), reading-time.ts, site.ts
scripts/            smoke.sh (post-deploy verification)
src/                Cloudflare Worker (index.ts, csp.ts, status.ts, metrics.ts)
tests/              Vitest
wrangler.jsonc      Worker config (ASSETS, STATUS KV, cron, custom domains)
```

### Uptime monitoring

The cron pings every entry in `MONITORS` (`src/status.ts`) every 5 minutes and
writes a JSON snapshot to KV (`status` key). `/api/status` serves the snapshot;
the front page (`/#status`) renders it with per-service history, capped at
`HISTORY_LIMIT` (149 ≈ 12.5h — the monolith's 1:4:9 proportions).

Add a service by extending `MONITORS`. Use `internal: true` for routes that
point at this site itself (the ASSETS binding is required — Workers block
self-fetches over the public URL). A check counts as up only on a final HTTP
200 (redirects followed).

### Metrics

- **Per-post views**: `GET/POST /api/views/<slug>` (KV `views:<slug>`). Counted
  once per browser session from the post page; bot UAs and cross-origin POSTs
  are ignored.
- **Visitors by country**: the Worker reads `request.cf.country` on human-looking
  HTML navigations (`Sec-Fetch-Mode: navigate` + non-bot UA), batches the counts
  in the isolate and flushes to KV at most once per minute (`geo` key). `GET
  /api/geo` feeds the world map on the front page. No cookies, no per-visitor
  tracking.
- **Reading time** is computed from markdown (~200 wpm, fenced code excluded).

The KV free tier allows 1000 puts/day total — the gating above keeps usage well
below that even when CT-log scanners hit a fresh domain.

### Manual deploy

Requires `wrangler login` and the KV namespace in `wrangler.jsonc` (or your own
id). Then `npm run deploy` — `predeploy` runs lint/typecheck/test first.

### Status (soft launch)

The site is live at `rozsoshnykh.no` (with 301 from `www` and
`d.rozsoshnykh.workers.dev`). `robots: { index: false }` stays until the first
posts are published. When the content is ready: flip `robots.index` to `true`
in `app/layout.tsx` and submit the sitemap in Google Search Console.
