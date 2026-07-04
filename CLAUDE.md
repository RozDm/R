# CLAUDE.md

Personal portfolio + blog for Dmytro Rozsoshnykh, live at https://rozsoshnykh.no.
Next.js 16 static export (App Router, `output: 'export'`) served by a Cloudflare
Worker. React 19, TypeScript 6, Tailwind v4. All site copy is Norwegian (nb-NO);
code and comments are English.

## Architecture

- `app/`, `components/` — Next App Router, `output: 'export'`, `trailingSlash: true`,
  Tailwind v4 (no config file, `@theme` in `app/globals.css`).
- Routes: `/` (Hero/Skills/Certifications/Status/Visitors/Trends sections), `/blogg`,
  `/blogg/[slug]`, `/blogg/tag/[slug]`, `/kontakt`, plus `feed.xml`, `sitemap`,
  `robots`, `manifest`, OG images. `error.tsx`/`global-error.tsx` are the
  client error boundaries (HAL-voiced "Systemfeil").
- `src/` — Cloudflare Worker, runs in front of the static export
  (`run_worker_first`):
  - `index.ts` — routing: HTTPS + canonical-host 301s (www/workers.dev → apex),
    `/status/` → `/#status`, API endpoints, per-request **hash-based CSP** for
    HTML it can decode.
  - `csp.ts` — security headers/CSP helpers (DOM-compatible APIs only; it is
    type-checked under BOTH tsconfigs because tests import it). Three policies:
    `strictCsp(hashes)` for readable HTML, `ENFORCED_CSP` for non-HTML assets +
    redirects (no `unsafe-inline` — nothing executes inline there), and
    `HTML_FALLBACK_CSP` (keeps `unsafe-inline`) only for HTML we couldn't decode
    to hash — effectively unreachable since assets are fetched as identity.
    All three share `COMMON_DIRECTIVES`, incl. `upgrade-insecure-requests`
    (belt for a legacy `http://` embed in a future post; HSTS + browser
    mixed-content auto-upgrade are the suspenders).
  - `status.ts` — uptime cron config + pure KV snapshot logic. `MONITORS` is
    the list of monitored services. `HISTORY_LIMIT = 149` (monolith 1:4:9 —
    intentional, don't "fix" it).
  - `metrics.ts` — pure logic for view/geo counters.
  - `timeseries.ts` — pure helpers for the AE-backed time-series endpoint
    (metric/range parsing, SQL builder, AE-response parser); type-checked under
    both tsconfigs since tests import it. Every `INTERVAL` literal is quoted
    (`INTERVAL '6' HOUR`) — AE's SQL parser 422s on the bare `INTERVAL 6 HOUR`.
- KV namespace `STATUS` holds only the uptime snapshot (`status` key).
- D1 database `rozsoshnykh-metrics-v2` (binding `METRICS`, schema in
  `schema/metrics.sql`): `views(slug, count)`, `geo(country, count)`, and
  `contact(id, at, ip, name, email, message)`. Counters use atomic
  `INSERT … ON CONFLICT … count = count + 1`. A dormant `subscribers` table
  remains from the removed newsletter sign-up (rows may exist in prod;
  nothing reads or writes it).
- Analytics Engine dataset `rozsoshnykh_metrics` (binding `METRICS_AE`) holds
  the sampled time-series behind the front-page **Trends** card
  (`components/home/Trends.tsx` — single Besøk metric, 24t/7d/30d range,
  smooth quadratic-curve area chart over a zero-filled bucket grid). Every
  `recordGeo` call (triggered by the `/api/visit` beacon — see below) also
  writes an AE point (`blob1='geo'`), so the map and the chart are two
  views of the same dataset. The `view` AE channel is also written from
  `/api/views` POSTs for future use, but isn't currently graphed. D1 stays
  the truth for totals; AE answers "when". Reads need two runtime Worker
  secrets — `CF_ACCOUNT_ID` + `AE_API_TOKEN` (token scoped `Account
  Analytics:Read`) — both fed from the `CLOUDFLARE_ACCOUNT_ID` /
  `AE_API_TOKEN` GitHub secrets by the deploy workflow's `wrangler secret
  put` loop. Missing either → empty series + "Ingen data ennå" (writes
  collect before the read token exists). AE is append-only — `METRICS_EPOCH`
  in `src/timeseries.ts` is a UTC string that filters out anything older
  client-side (sidesteps any AE-SQL dialect surprise); bump it after every
  `reset-metrics` run.
- Visit counting: every page mounts `components/effects/VisitBeacon.tsx`
  (from `app/layout.tsx`) which fires a single `POST /api/visit` per
  browser session (sessionStorage flag — set BEFORE the fetch so React
  StrictMode's dev double-invoke can't double-count). The handler runs
  `recordGeo(env, ctx, request.cf?.country)` — one beacon writes the D1
  `geo` row and the AE point. Clicking through several pages still counts
  as one besøk.
- Contact form has Turnstile wired in but feature-gated by env: the widget
  renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set at build time,
  and the worker enforces verification only when `TURNSTILE_SECRET` is set
  (`wrangler secret put TURNSTILE_SECRET`). Both halves must be on for the
  challenge to apply; either side empty keeps the form working with the
  pre-existing defences (Sec-Fetch, UA filter, honeypot, D1 rate limit). A
  double-submit (same address + message within 2 min) is deduped in D1 and
  ack'd without a second e-mail — content-keyed, so no schema column is needed.
- Worker APIs: `/api/status`, `/api/views/<slug>` (GET read, POST count —
  POST gated by `isWriteAllowed` = same-origin + non-bot), `/api/geo`
  (read-only, edge-cached 60s), `/api/visit` (POST, the single Besøk
  beacon — see Visit counting above; also answers GET with a harmless
  self-diagnostic — the caller's own country + whether it counts), `/api/timeseries?metric=view|geo&range=24h|7d|30d`
  (GET, edge-cached per metric+range; `view` channel still served for API
  compat, only `geo` is graphed), `/api/contact` (POST, full Turnstile
  challenge).
- The visitor world map is a build-time artifact: `scripts/build-world-svg.mjs`
  (run by `prebuild`) emits `public/world.svg` from `world-map-country-shapes`
  (a devDependency). `GeoMap` fetches that SVG and injects it via
  `dangerouslySetInnerHTML` — never touch a React-managed node's innerHTML by
  ref, that crashed prod once. Country colours come from CSS (`.geo-map path`,
  vars `--map-empty`/`--map-stroke` switch on `.dark`); JS only stamps a
  `data-v` intensity bucket (1/2/3), so a theme toggle recolours with no re-run.
  The build script also bakes a grey `fill`/`stroke` onto every `<path>` and the
  CSS keeps `var()` fallbacks — don't strip either: a path with no resolved fill
  defaults to **black**, so the bare-var version flashed (and sometimes stuck)
  an all-black map. Presentation attributes sit below CSS in the cascade, so the
  theme vars and `data-v` rules still win.
- `TURNSTILE_SECRET` is a runtime Worker secret (not in wrangler.jsonc), typed
  via `src/env.d.ts`; the deploy workflow pushes it with `wrangler secret put`
  from a GitHub secret. `TURNSTILE_SITE_KEY` is a GitHub secret inlined into
  the build as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
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
- The merge gate is **hands-off**: `main` carries a branch-protection rule
  requiring the `check` status check (the PR-side lint/typecheck/test/build
  job) with **0 required approvals** — a solo repo, so you cannot approve your
  own PR. PRs are opened *ready* (not draft) with **squash auto-merge**
  enabled, so a green `check` merges them automatically and fires the deploy
  above; a red `check` leaves the PR open with auto-merge pending. To hold a
  PR for a manual look instead, open it as a draft and don't enable auto-merge.
- Sandbox egress varies: older web sandboxes had none; newer remote sessions
  route HTTPS through an agent proxy, so `curl https://rozsoshnykh.no/...`
  works for live diagnosis (a browser needs `--ssl-version-max=tls1.2` — the
  proxy's TLS terminator resets Chromium's TLS 1.3 hello). The deploy gate is
  still the smoke-test step in the deploy run logs, not ad-hoc curl.

## Conventions

- Section pattern on the front page: mono uppercase red eyebrow
  (`text-red-500 … tracking-widest uppercase`) + bold h2 + cards
  (`bg-white dark:bg-gray-900/50 rounded-xl border … hover:border-red-500/30`),
  staggered `animate-fade-in` delays (0/150/300/450/600/750ms).
- Accent is red-500/red-400; font is Intel One Mono via CSS variable.
- 2001: A Space Odyssey theme is deliberate and load-bearing: intro
  (`HEI %USERNAME%` → stars → monolith → HAL eye), 404, `error.tsx`,
  `HalIdle` screensaver (idle 75s on the front page; recurring, script
  shortens each appearance, cinematic CRT line reveal via `.hal-text-reveal`),
  loader copy («Åpner podbay-dørene…», «Kalibrerer AE-35-enheten…»), console
  greeting, `HISTORY_LIMIT = 149`. Keep the `%USERNAME%` placeholder joke
  literal — it is not a template var.
- Blog posts: `content/blog/<slug>.md`, frontmatter `title`, `description`,
  `date` (ISO), `tags`, optional `updated` and `draft: true`. Tags are
  normalized/deduped via `lib/tags.ts`
  (`normalizeTag`/`normalizeTags`/`tagToSlug`); the canonical list and alias
  map live in `data/tags.ts` (data next to `skills.ts`/`certifications.ts`,
  logic in `lib/`). Reading time is computed, not stored. Code blocks are highlighted at build via `rehype-highlight`
  (theme in `app/globals.css`). Drafts: `draft: true` keeps a post out of
  every public surface (list, sitemap, RSS, tag pages, slug routing) at
  build time — `getPostSlugs`/`getAllPosts` filter on `NODE_ENV !==
  'production'`, so the slug never reaches `generateStaticParams` and 404s
  in prod. `npm run dev` renders drafts with a red "Utkast" badge. Remove
  the `draft: true` line to publish. `/new-post` scaffolds new posts as
  drafts by default.
- SEO: canonicals + trailing slash everywhere, OG images via `next/og`,
  JSON-LD (Person + WebSite sitewide, BlogPosting + image + BreadcrumbList per
  post), RSS at `/feed.xml`, prev/next + tag pages. `robots.index: false` in
  `app/layout.tsx` until launch — flip it only when asked, then submit the
  sitemap in Search Console. `/kontakt` and `/status`-style utility content
  stay noindex permanently; the sitemap must not list noindex URLs.

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
- ESLint stays on 9 (with `eslint-config-next` 16's native flat config); the
  React plugin it pulls in is not yet ESLint-10-compatible. Don't bump ESLint.
- `package.json` is NOT `"type": "module"` — adding it breaks the Next 16 /
  turbopack config load. Standalone Node scripts use the `.mjs` extension
  instead (e.g. `scripts/build-world-svg.mjs`).
- No R2 (it requires a card even on the free tier) — metrics backup is the
  weekly `d1-backup.yml` GitHub Actions cron (90-day artifact). The repo is
  public, so the dump is gpg-encrypted with the `BACKUP_PASSPHRASE` secret
  before upload; the run fails rather than upload plaintext if the secret is
  missing.
- Resetting metrics: the manual `reset-metrics.yml` (`workflow_dispatch`, type
  `RESET` to confirm) wipes the D1 `views` + `geo` counters and prints
  before/after counts; it supersedes the older geo-only `geo-reset.yml`. AE
  can't be reset (append-only) — its points age out of the 24h/7d/30d windows
  on their own, or add a launch-epoch floor to the SQL for a clean graph sooner.
- The database is `rozsoshnykh-metrics-v2` because the original died
  server-side on 2026-07-03 (internal error 7500 on every operation,
  including Time Travel — no restore possible). Its deleted entry still
  ghost-locks the old name: `d1 list` shows it, every call against it 7404s,
  and `d1 create rozsoshnykh-metrics` says "already exists" — don't try to
  reclaim the old name. `d1-repair.yml` (`workflow_dispatch`) is the D1
  surgery kit from that incident: `info` (read-only probe), `restore`
  (Time Travel), `create` (no existence check, for the ghost trap),
  `recreate` (delete+create, type RECREATE), and `sql` (one statement from
  the input — for surgical fixes where reset-metrics is too blunt).
- Country flags in the GeoMap legend use a self-hosted Twemoji subset
  (`public/fonts/TwemojiCountryFlags.woff2`, `@font-face` with
  `unicode-range: U+1F1E6-1F1FF`, class `.font-flag`) — Windows ships no
  regional-indicator glyphs, so the system fallback renders letter pairs. The
  `unicode-range` keeps the font from downloading unless a flag is on the page;
  `font-src 'self'` already covers it.
- `app/template.tsx` cross-fades route changes (450ms `animate-page-in`;
  templates re-mount per navigation). OPACITY-ONLY on purpose — a transform
  would become a containing block for the `position:fixed` intro overlays /
  sticky header — and the **home route opts out** (`usePathname() !== '/'`) so
  the intro's z-100 overlay + black pre-paint cover keep a clean stacking
  context. Respects `prefers-reduced-motion`.
- In-page nav (`components/layout/HashLink.tsx`): on `/` it intercepts
  `/#x` clicks and calls native `target.scrollIntoView({behavior:'smooth'})`
  + `history.pushState` (Next's `<Link href="/#x">` otherwise concatenates
  hashes into `/#main#about`, and setting `location.hash` would instant-jump
  past the smooth scroll). The header offset is pure CSS (`scroll-padding-top`,
  above) — don't reintroduce a custom rAF scroll, it fights the global
  `scroll-behavior: smooth` and stutters. Off the home route, plain `<Link>`.
- `@cloudflare/vitest-pool-workers` is not yet compatible with Vitest 4, so
  worker routes are covered by `scripts/smoke.sh` in CI, not unit tests.
- `StatusDashboard`, `GeoMap` and `TrendsChart` are all code-split via
  `next/dynamic` (`ssr: false`) through `LazyStatusDashboard.tsx`,
  `LazyGeoMap.tsx` and `LazyTrendsChart.tsx` — none of the three are in
  the static HTML. The section headings (`Driftsstatus`, `Hvor leserne
  kommer fra`, `Trafikk over tid`) live in the server components
  `Status.tsx`, `Visitors.tsx` and `Trends.tsx` so the smoke test can
  grep them and SEO sees the structure even before the charts hydrate.
  Keep the headings on the server side — moving a heading into a lazy
  half drops it from the static HTML and breaks the smoke check.
- Session branches: work on a `claude/*` branch (one per session), and reset
  it onto `origin/main` before starting new work or the next PR conflicts with
  its own squashed history. **Automatically delete head branches** is on, so a
  *merged* PR's branch is removed by GitHub — no manual cleanup. Only a PR
  *closed without merging* leaves its branch behind to delete by hand.
