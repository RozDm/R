# CLAUDE.md

Personal portfolio + blog for Dmytro Rozsoshnykh, live at https://rozsoshnykh.no.
Next.js 15 static export served by a Cloudflare Worker. All site copy is
Norwegian (nb-NO); code and comments are English.

## Architecture

- `app/`, `components/` — Next App Router, `output: 'export'`, `trailingSlash: true`,
  Tailwind v4 (no config file, `@theme` in `app/globals.css`).
- `src/` — Cloudflare Worker, runs in front of the static export
  (`run_worker_first`):
  - `index.ts` — routing: HTTPS + canonical-host 301s (www/workers.dev → apex),
    `/status/` → `/#status`, API endpoints, per-request **hash-based CSP** for
    HTML it can decode (fallback policy keeps `unsafe-inline`).
  - `csp.ts` — security headers/CSP helpers (DOM-compatible APIs only; it is
    type-checked under BOTH tsconfigs because tests import it).
  - `status.ts` — uptime cron config + pure KV snapshot logic. `MONITORS` is
    the list of monitored services. `HISTORY_LIMIT = 149` (monolith 1:4:9 —
    intentional, don't "fix" it).
  - `metrics.ts` — pure logic for view/geo counters.
- KV namespace `STATUS` holds only the uptime snapshot (`status` key).
- D1 database `rozsoshnykh-metrics` (binding `METRICS`, schema in
  `schema/metrics.sql`): `views(slug, count)` and `geo(country, count)`;
  increments are atomic `INSERT … ON CONFLICT … count = count + 1`.
- Worker APIs: `/api/status`, `/api/views/<slug>` (GET read, POST count),
  `/api/geo`. Geo is recorded on the edge from `request.cf.country` for
  human-looking navigations (`Sec-Fetch-Mode: navigate` + non-bot UA).
- TypeScript is split: app uses `tsconfig.json` (lib.dom), worker uses
  `tsconfig.worker.json` + generated `worker-configuration.d.ts`. After any
  `wrangler.jsonc` change run `npm run cf-typegen` and commit the result.

## Commands

- `npm run lint` / `npm run typecheck` / `npm test` — all must pass before a PR.
- `npm run build` — static export to `out/`.
- Deploy happens via **PR → squash-merge to `main` → GitHub Actions**
  (`.github/workflows/deploy.yml`: checks → build → wrangler → `scripts/smoke.sh`
  against the live site). Never `wrangler deploy` from a web sandbox (no
  network); `npm run deploy` works locally and is gated by `predeploy`.
- The web sandbox cannot reach the public internet (egress allowlist): verify
  production through the smoke-test step in the deploy run logs, not curl.

## Conventions

- Section pattern on the front page: mono uppercase red eyebrow
  (`text-red-500 … tracking-widest uppercase`) + bold h2 + cards
  (`bg-white dark:bg-gray-900/50 rounded-xl border … hover:border-red-500/30`),
  staggered `animate-fade-in` delays (0/150/300/450/600ms).
- Accent is red-500/red-400; font is Intel One Mono via CSS variable.
- 2001: A Space Odyssey theme is deliberate and load-bearing: intro
  (`HEI %USERNAME%` → stars → monolith → HAL eye), 404, `HalIdle` screensaver
  (idle 75s on the front page), loader copy («Åpner podbay-dørene…»,
  «Kalibrerer AE-35-enheten…»), console greeting, `HISTORY_LIMIT = 149`.
  Keep the `%USERNAME%` placeholder joke literal — it is not a template var.
- Blog posts: `content/blog/<slug>.md`, frontmatter `title`, `description`,
  `date` (ISO), `tags`. Tags are normalized/deduped via `lib/tags.ts`
  (aliases → canonical names). Reading time is computed, not stored.
- SEO: canonicals + trailing slash everywhere, OG images via `next/og`,
  JSON-LD (Person sitewide, BlogPosting + image per post), RSS at `/feed.xml`.
  `robots.index: false` in `app/layout.tsx` until launch — flip it only when
  asked, then submit the sitemap in Search Console.

## Gotchas

- `workers_dev: true` in `wrangler.jsonc` must stay — wrangler silently
  disables the workers.dev subdomain when routes exist, which 404s old links
  instead of letting the Worker 301 them.
- A Worker cannot fetch its own public URL — monitors pointing at this site
  need `internal: true` (ASSETS binding). Don't monitor the site itself; the
  dashboard is served by it.
- KV free tier: 1000 writes/day total — that's why metrics moved to D1
  (100k writes/day); only the 5-minute cron writes to KV. Don't add KV
  writes lightly.
- Session branches: work on a `claude/*` branch, PRs are squash-merged, so
  reset the branch onto `origin/main` before starting new work or the next
  PR will conflict with its own squashed history.
