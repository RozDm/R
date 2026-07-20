# CLAUDE.md

Personal portfolio + blog for Dmytro Rozsoshnykh, live at https://rozsoshnykh.no.
Next.js 16 static export (App Router, `output: 'export'`) served by a Cloudflare
Worker. React 19, TypeScript 6, Tailwind v4. All site copy is Norwegian (nb-NO);
code and comments are English.

## Agent notes

- Generated files — never Read or Grep them: `worker-configuration.d.ts`
  (~540 kB, regenerate via `npm run cf-typegen`) and `package-lock.json`
  (~350 kB, npm owns it). Searching them burns context for zero signal;
  scope searches to `src/`, `app/`, `components/`, `lib/`, `tests/` instead.
- Structure drift is worse than missing docs: any PR that adds, moves or
  removes files in `src/`, `app/`, `components/` or `lib/`, or changes the
  `/api/*` surface, MUST update the Architecture section below (and
  `src/CLAUDE.md` for worker internals) in the same PR.
- Worker-specific rules live in `src/CLAUDE.md` (picked up automatically when
  working under `src/`). The "why" behind the hard rules — incident history
  (the D1 death, the font reflow, the all-black map) — lives in
  `docs/history.md`; read it only when a rule seems wrong or you are tempted
  to undo one.

## Architecture

- `app/`, `components/` — Next App Router, `output: 'export'`, `trailingSlash: true`,
  Tailwind v4 (no config file, `@theme` in `app/globals.css`).
- Routes: `/` (Hero/Skills/Certifications/Status/Visitors/Trends sections), `/blogg`,
  `/blogg/[slug]`, `/blogg/tag/[slug]`, `/kontakt`, `/personvern` (privacy
  notice, linked from the footer + `/kontakt`), plus `feed.xml`, `sitemap`,
  `robots`, `manifest`, OG images, and `/.well-known/security.txt` (RFC 9116,
  static in `public/` — bump its `Expires` yearly). `error.tsx`/`global-error.tsx` are the
  client error boundaries (HAL-voiced "Systemfeil").
- `src/` — Cloudflare Worker, runs in front of the static export
  (`run_worker_first`):
  - `index.ts` — entry point: HTTPS + canonical-host 301s (www/workers.dev →
    apex), `/status/` → `/#status`, dispatches `/api/*` to `src/routes/`,
    per-request **hash-based CSP** for HTML it can decode, cron dispatch
    (5-min health checks + daily contact prune) and the status-alert mail.
  - `routes/` — one handler per endpoint: `status.ts`, `views.ts`, `geo.ts`,
    `visit.ts`, `timeseries.ts`, `contact.ts`. Each returns `null` when the
    path isn't its own; `index.ts` chains them with `??`.
  - `http.ts` — `apiJson()` (JSON + security headers) and the edge-cache pair
    `cachedApiJson()`/`putCachedApiJson()`; cache keys are built from
    validated params only so junk query strings can't fragment the cache.
  - `csp.ts` — security headers/CSP helpers + `cacheControlFor()`
    (DOM-compatible APIs only; type-checked under BOTH tsconfigs because
    tests import it). Three policies: `strictCsp(hashes)` for readable HTML,
    `ENFORCED_CSP` for non-HTML assets + redirects (no `unsafe-inline` —
    nothing executes inline there), and `HTML_FALLBACK_CSP` (keeps
    `unsafe-inline`) only for HTML we couldn't decode to hash — effectively
    unreachable since assets are fetched as identity. All three share
    `COMMON_DIRECTIVES`, incl. `upgrade-insecure-requests`.
  - `status.ts` — uptime cron config + pure KV snapshot/alert logic.
    `MONITORS` is the list of monitored services. `HISTORY_LIMIT = 149`
    (monolith 1:4:9 — intentional, don't "fix" it). `detectTransitions` is
    flap-damped: «nede» mails only after `CONSECUTIVE_FAILS_TO_ALERT` (2)
    consecutive failed probes, «oppe igjen» on the first success after an
    alerted outage.
  - `contact.ts` — pure contact/alert mail logic: validation limits,
    Turnstile verify, MIME building (DOM-compatible; tests import it).
  - `metrics.ts` — pure logic for view/geo counters: slug/country
    validation, bot filter, the `isWriteAllowed` header gate.
  - `timeseries.ts` — pure helpers for the AE-backed time-series endpoint
    (metric/range parsing, SQL builder, AE-response parser, `METRICS_EPOCH`);
    type-checked under both tsconfigs since tests import it.
- KV namespace `STATUS` holds only the uptime snapshot (`status` key).
- D1 database `rozsoshnykh-metrics-v2` (binding `METRICS`, schema in
  `schema/metrics.sql`): `views(slug, count)`, `geo(country, count)`, and
  `contact(id, at, ip, name, email, message)`. Counters use atomic
  `INSERT … ON CONFLICT … count = count + 1`. A dormant `subscribers` table
  remains from the removed newsletter sign-up (rows may exist in prod;
  nothing reads or writes it).
- Analytics Engine dataset `rozsoshnykh_metrics` (binding `METRICS_AE`) is
  the sampled time-series behind the front-page **Trends** card
  (`components/home/Trends.tsx` — single Besøk metric, 24t/7d/30d/**Alt**
  tabs, dot plot over a zero-filled bucket grid). Division of labour: D1 is
  the truth for totals, AE answers "when". The headline number is per-tab:
  the windowed tabs (24t/7d/30d) show the AE (sampled) count for their
  window; the **Alt** (all-time) tab shows the exact D1 count from
  `/api/geo` — the same number as the map — so the one tab that promises a
  grand total can't drift from the map under AE sampling. `Alt`'s wave is
  6h-bucketed like 30d, spans epoch→now, capped at ~90 days (near AE
  retention) in `fillBuckets`; since its total is D1, the wave aging past
  retention never desyncs the number from the map. Every `recordGeo` call
  (from the `/api/visit` beacon) writes both the D1 `geo` row and an AE
  point (`blob1='geo'`) — the map and the chart are two views of the same
  dataset. The `view` AE channel is also written from `/api/views` POSTs
  but isn't graphed yet. AE reads need two runtime Worker secrets —
  `CF_ACCOUNT_ID` + `AE_API_TOKEN` (scoped `Account Analytics:Read`), fed
  from GitHub secrets by the deploy workflow's `wrangler secret put` loop;
  missing either → empty series + "Ingen data ennå".
- `METRICS_EPOCH` (`src/timeseries.ts`): AE is append-only, so this UTC
  string filters out pre-relaunch points client-side. Bump it after every
  `reset-metrics` run. It **must sit on a 6-hour UTC boundary**
  (00/06/12/18; unit-tested in `tests/timeseries.test.ts`) — a mid-bucket
  epoch drops a straddling 6h bucket's real visits and the chart undercounts
  the map (why: `docs/history.md`). Round UP to the next boundary.
- Visit counting: every page mounts `components/effects/VisitBeacon.tsx`
  (from `app/layout.tsx`) which fires a single `POST /api/visit` per browser
  session. Rule for ALL client-side counters (`VisitBeacon`, `ViewCounter`):
  set the sessionStorage dedupe flag BEFORE the fetch, so React StrictMode's
  dev double-invoke and remount races can't double-count. The handler runs
  `recordGeo(env, ctx, request.cf?.country)` — one beacon writes the D1
  `geo` row and the AE point; clicking through several pages counts as one
  besøk.
- Contact form has Turnstile wired in but feature-gated by env: the widget
  renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set at build time,
  and the worker enforces verification only when `TURNSTILE_SECRET` is set
  (`wrangler secret put TURNSTILE_SECRET`). Both halves must be on for the
  challenge to apply; either side empty keeps the form working with the
  pre-existing defences (Sec-Fetch, UA filter, honeypot, D1 rate limit). A
  double-submit (same address + message within 2 min) is deduped in D1 and
  ack'd without a second e-mail — content-keyed, so no schema column is needed.
- Worker APIs: `/api/status` (GET, edge-cached 60s), `/api/views/<slug>`
  (GET read; POST count — gated by `isWriteAllowed` = same-origin + non-bot
  AND the slug must resolve to a published post page via the ASSETS binding,
  since the header gates are spoofable and would otherwise let junk slugs
  mint D1 rows forever), `/api/geo` (read-only, edge-cached 60s),
  `/api/visit` (POST, the single Besøk beacon — see Visit counting above;
  GET is a harmless self-diagnostic: the caller's own country + whether it
  counts), `/api/timeseries?metric=view|geo&range=24h|7d|30d|all` (GET,
  edge-cached per metric+range; `view` still served for API compat, only
  `geo` is graphed; `all` spans ~90 days at 6h buckets — see the Trends card
  above), `/api/contact` (POST, full Turnstile challenge). Every edge-cached
  endpoint builds its cache key from the validated params only
  (`cachedApiJson(canonicalUrl)`) so junk query strings can't fragment the
  cache and hammer KV/D1/AE.
- The visitor world map is a build-time artifact: `scripts/build-world-svg.mjs`
  (run by `prebuild`) emits `public/world.svg` from `world-map-country-shapes`
  (a devDependency). `GeoMap` fetches that SVG and injects it via
  `dangerouslySetInnerHTML` — never touch a React-managed node's innerHTML by
  ref (crashed prod once). Country colours come from CSS (`.geo-map path`,
  vars `--map-empty`/`--map-stroke` switch on `.dark`); JS only stamps a
  `data-v` intensity bucket (1/2/3), so a theme toggle recolours with no
  re-run. The build script bakes a grey `fill`/`stroke` onto every `<path>`
  AND the CSS keeps `var()` fallbacks — don't strip either: an unstyled SVG
  path renders **black** (full story: `docs/history.md`).
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
  sitemap in Search Console. `/kontakt`, `/personvern` and `/status`-style
  utility content stay noindex permanently; the sitemap must not list noindex
  URLs.

## Gotchas

- `workers_dev: true` in `wrangler.jsonc` must stay — wrangler silently
  disables the workers.dev subdomain when routes exist, which 404s old links
  instead of letting the Worker 301 them.
- Static-asset browser caching lives in `cacheControlFor()` (`src/csp.ts`),
  applied by the Worker's non-HTML branch. The Workers Assets binding tags
  every file `max-age=0, must-revalidate` and the Worker re-fetches assets
  without forwarding `If-None-Match`, so without this override a repeat visit
  re-downloads every chunk in full (no 304). Rule: `/_next/static/*` is
  content-hashed → `immutable`; `/world.svg` + `/fonts/*` are big and
  stable → 1-week cache; HTML stays default no-cache (per-request hash-CSP
  needs a fresh document). Security-neutral — CSP still gates loads; caching
  only skips re-fetching identical bytes. `smoke.sh` guards the world.svg
  header as the stable-URL canary.
- KV free tier: 1000 writes/day total — only the 5-minute cron writes to KV;
  per-request counters go to D1 (100k writes/day) or AE (10M points/day).
  Don't add KV writes lightly.
- ESLint stays on 9 (with `eslint-config-next` 16's native flat config); the
  React plugin it pulls in is not yet ESLint-10-compatible. Don't bump ESLint.
- `package.json` is NOT `"type": "module"` — adding it breaks the Next 16 /
  turbopack config load. Standalone Node scripts use the `.mjs` extension
  instead (e.g. `scripts/build-world-svg.mjs`).
- No R2 (it requires a card even on the free tier) and no off-platform metrics
  backup — D1 Time Travel (30 days, Cloudflare-side) is the only restore path,
  a deliberate accepted risk (details + removed backup workflow:
  `docs/history.md`; don't reintroduce a backup without being asked).
- Resetting metrics: the manual `reset-metrics.yml` (`workflow_dispatch`, type
  `RESET` to confirm) wipes the D1 `views` + `geo` counters and prints
  before/after counts. AE can't be reset (append-only) — its points age out
  of the range windows on their own; bump `METRICS_EPOCH` after every reset
  (see Architecture above).
- The database is `rozsoshnykh-metrics-v2`: the original died server-side on
  2026-07-03 and its deleted entry still ghost-locks the old name — never try
  to reclaim `rozsoshnykh-metrics` (full story: `docs/history.md`).
  `d1-repair.yml` (`workflow_dispatch`) is the surgery kit from that
  incident: `info` (read-only probe), `restore` (Time Travel), `create` (no
  existence check, for the ghost trap), `recreate` (delete+create, type
  RECREATE), and `sql` (one statement from the input — for surgical fixes
  where reset-metrics is too blunt).
- Country flags in the GeoMap legend use a self-hosted Twemoji subset
  (`public/fonts/TwemojiCountryFlags.woff2`, `@font-face` with
  `unicode-range: U+1F1E6-1F1FF`, class `.font-flag`) — Windows ships no
  regional-indicator glyphs, so the system fallback renders letter pairs. The
  `unicode-range` keeps the font from downloading unless a flag is on the page;
  `font-src 'self'` already covers it.
- Body font `Intel One Mono` uses `display: 'optional'` (not `swap`) in
  `app/layout.tsx` — deliberate: `next/font` has no metrics for this face, so
  with `swap` the whole page reflowed when the web font arrived on a cold
  first paint. Don't switch it back to `swap` without first adding a
  hand-built metric-matched fallback @font-face (full story: `docs/history.md`).
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
