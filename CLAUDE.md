# CLAUDE.md

Personal portfolio + blog for Dmytro Rozsoshnykh, live at https://rozsoshnykh.no.
Next.js 16 static export (App Router, `output: 'export'`) served by Cloudflare
Workers static assets, with a Worker for `/api/*`. React 19, TypeScript 6, Tailwind v4. The site is Norwegian (nb-NO) at
the root with an English twin under `/en/` (front page, contact, privacy,
blog). Code and comments are English.

## Where the rules live

Context is split so a session loads only what its task touches:
- this file — site-wide map, commands, conventions;
- `src/CLAUDE.md` — Worker internals: modules, bindings, the `/api/*` surface,
  worker tests (loads when you open anything under `src/`);
- `.github/CLAUDE.md` — deploy pipeline and the ops workflows (watchdog,
  analytics report, metrics reset, D1 repair);
- `.claude/skills/browser-check` — the Playwright recipe for looking at a
  built page;
- `docs/cloudflare-security.md` — the zone's edge security on the Free plan
  (WAF custom rule, rate limiting, Bot Fight Mode, AI bots): the deployed
  config, verified Free limits, execution order, known pitfalls and the
  owner's open dashboard to-do; read it before touching zone security or
  when a 403/429 isn't the Worker's;
- `docs/history.md` — the incidents behind the hard rules; read it only when
  a rule seems wrong or you are tempted to undo one.

A PR that adds, moves or removes files in `src/`, `app/`, `components/` or
`lib/`, or changes the `/api/*` surface, updates the matching file above in
the same PR — structure drift is worse than missing docs. Enforced:
`scripts/check-docs.mjs` (run by `tests/docs.test.ts`, so CI blocks the
merge) fails when a doc names a path that doesn't exist, or when a Worker
module, `/api/*` route, `app/` route dir, `lib/` file, workflow, script,
skill or hook is in no doc. The Stop hook `.claude/hooks/stop-docs.mjs` runs
it before a session ends, and also blocks once when the branch adds, removes
or renames such files without touching any doc — fix the doc, or say why
none applies.

## Working efficiently

Token economy is a standing requirement of every task here, not a mode to
switch on: read only the part of a file the task needs (Grep first, then
`offset`/`limit`), batch independent calls, don't re-run what already
answered, keep output and replies short.

- `worker-configuration.d.ts` (generated: `npm run cf-typegen`),
  `package-lock.json` (npm owns it) and `public/world.svg` (built by
  `prebuild`) are denied to Read in `.claude/settings.json`, skipped by
  Grep/Glob via `.ignore`, and shown as binary by `git diff` via
  `.gitattributes`; the PreToolUse hook `.claude/hooks/guard-bash.mjs`
  denies shell reads of them (`cat`, `grep`, `git show rev:file`, …).
  `git diff --stat` tells you whether they changed.
- `npm run check` runs lint + typecheck + tests in one call. Run
  `npm run build` only when the change touches pages, metadata, the export
  or `scripts/`.
- GitHub MCP: fetch one thing. PR CI → `pull_request_read` `get_check_runs`;
  the deploy → `actions_list` `list_workflow_runs` with
  `resource_id: deploy.yml`, `perPage: 1`. Unpaged run listings repeat every
  squashed commit message.
- After opening a PR, don't arm `send_later` check-ins: a green `check`
  auto-merges within minutes and the PR subscription wakes the session on
  anything red. Once it merges, look at the deploy run once — its smoke step
  is the real gate.
- Commit messages: a subject plus a few lines at most. PR bodies: what
  changed and why in short bullets — no file-by-file tour, the diff has it.
- Replies to the owner (who writes in Russian): outcome first, then only
  what needs their decision or action; no recap of the diff.

## Architecture

- `app/`, `components/` — App Router, `trailingSlash: true`, Tailwind v4 (no
  config file, `@theme` in `app/globals.css`).
- Routes (Norwegian at the root, English twins under `/en/`): `/` + `/en/`
  (Hero/Skills/Certifications/Status/Visitors/Trends), `/blogg/…` +
  `/en/blog/…` (index, `[slug]`, `tag/[slug]`), `/kontakt` + `/en/contact`,
  `/personvern` + `/en/privacy` (privacy notice, linked from the footer and
  the contact page), plus `feed.xml` + `en/feed.xml`, `sitemap`, `robots`,
  `manifest`, OG images, `/icons/*.png` (build-time PNGs of `app/icon.svg`
  for the manifest + apple-touch-icon, `app/icons/[name]/route.tsx`, which
  also builds `favicon.ico` — the build copies it to `/favicon.ico`) and
  `/.well-known/security.txt` (static in `public/`, RFC 9116 — bump its
  `Expires` yearly). `error.tsx` / `global-error.tsx` are the HAL-voiced
  «Systemfeil» boundaries.
- Languages: ALL UI copy lives in `data/i18n.ts` — `nb` defines the shape,
  `en` is typed against it, `tests/i18n.test.ts` checks parity; never
  hard-code copy in a component. One exception: `app/error.tsx` reads
  `ERROR_COPY` from `data/i18n-error.ts` (spread into `nb`/`en`, so one
  source) — it loads on every page in its own chunk, and importing `DICT`
  there put a second copy of the dictionary on every page. Server
  components take `lang` from their page (both languages share `HomePage`,
  `ContactPage` and the blog page components); client components call
  `useLang()`. Links between pages go through `localePath()`
  (`lib/i18n.ts`, the static pairs); blog posts and tags pair dynamically
  and pass their twin as `Header alternate` (the NO/EN switch) +
  `pageMetadata({ languages })` (hreflang). Bilingual data uses
  `Localized` + `pick()`. The export always says `<html lang="nb">`: the
  build (`scripts/finalize-export.mjs`) rewrites `/en/` documents to `en`,
  `HtmlLang` keeps it right on client navigation. `/en/privacy/` translates `/personvern/` (the Norwegian
  one is authoritative) — change both.
- Metadata: every page builds it with `pageMetadata()` (`lib/metadata.ts`;
  `lang: 'en'` on English pages sets og:locale, hreflang, the English OG card
  and the `/en/feed.xml` alternate).
  Next merges route metadata SHALLOWLY, so a page setting only part of
  `openGraph`/`alternates` drops og:url, og:image, og:site_name and the RSS
  alternate. The root layout has no canonical/og:url on purpose (the 404
  inherits it). Name, roles, site title/description and the light/dark
  background colours (`THEME_BG`, mirrored by themeColor, the manifest and
  `ThemeContext`) live in `lib/site.ts` — never hard-code them.
- Serving: the asset server answers every page and file straight from
  `out/` — no Worker request (`run_worker_first: ["/api/*"]`; a miss gets the
  404 page, never the Worker). Every Worker invocation counts against the
  free plan's 100k requests/day and past it gets a 429; asset requests are
  free, unlimited and keep working past it, so the quota can only take out
  `/api/*`, never the pages. What the Worker used to do per request is done
  once at build by `scripts/finalize-export.mjs` (postbuild): each page's
  hash-based CSP as a `<meta>` atop `<head>`, ahead of any script (`withMetaCsp`,
  `src/csp.ts`), `lang="en"` for `/en/`, `/favicon.ico`, and a 301 from every
  slash-less page path into `out/_redirects` (the asset server's own is a
  307); `npm run check:csp` re-checks the hashes in CI, deploy and smoke.
  Headers come from `public/_headers` (`/*`: HSTS, the header CSP
  `HEADER_CSP` — `frame-ancestors`, which `<meta>` can't carry, and NO fetch
  directive, or it would veto the hashes — `Reporting-Endpoints` and the
  rest; `X-Frame-Options` on the page paths; caches; OG `Content-Type`),
  kept equal to the Worker's own set by `tests/static-assets.test.ts`;
  `/status` → `/#status` in `public/_redirects`; www → apex and HTTP → HTTPS
  at the edge (`zone-rules.yml`). The zone's rate limiting rule
  (`docs/cloudflare-security.md`) excludes the static prefixes by hand.
- `src/` — the Cloudflare Worker for `/api/*` and the crons (canonical-host
  301 for the API; an `/api/` path no route claims gets the 404 page with
  the `_headers` set). `_headers` can't match on status, so a
  zone Response Header Transform Rule (`.github/workflows/zone-rules.yml`)
  makes every 4xx/5xx `no-store`. Stores: KV `STATUS` (uptime snapshot only), D1
  `rozsoshnykh-metrics-v2` (`METRICS`: view/geo counters, contact log),
  Analytics Engine `rozsoshnykh_metrics` (`METRICS_AE`: time series).
  Endpoints: `/api/status`, `/api/views/<slug>`, `/api/geo`, `/api/visit`,
  `/api/timeseries`, `/api/contact`, `/api/csp-report`. Details:
  `src/CLAUDE.md`. Every client fetch of `/api/*` uses `cache: 'no-store'` —
  keep it (the zone's Browser Cache TTL rewrote `max-age`; `zone-rules.yml`
  now sets it to Respect Existing Headers, but a drifted setting would
  bring the rewrite back).
- Visit counting: `components/effects/VisitBeacon.tsx` (mounted by
  `app/layout.tsx`) fires one `POST /api/visit` per sessionStorage session
  (per tab), which writes the D1 `geo` row and an AE point — the map and the
  Trends chart are two views of one dataset. Rule for ALL client counters
  (`VisitBeacon`, `ViewCounter`): set the sessionStorage dedupe flag BEFORE
  the fetch, so StrictMode's double-invoke and remount races can't
  double-count. `ViewCounter` hides counts under 50 (`MIN_SHOWN`); the map
  and Trends hide every absolute visit number (legend, tooltips, headline,
  y-axis) until the all-time D1 total reaches `MIN_PUBLIC_VISITS`
  (`lib/geo.ts`) — shades and the chart's shape stay.
- Trends card (`components/home/Trends.tsx`): one Besøk metric, tabs
  24t/7d/30d/**Alt**, dot plot over a zero-filled bucket grid
  (`lib/timeseries-fill.ts`). D1 is the truth for totals, AE answers "when":
  the windowed tabs show the sampled AE count for their window; **Alt** shows
  the exact D1 total from `/api/geo`, the same number as the map, so it can't
  drift under AE sampling. Alt's wave is 6h-bucketed from `METRICS_EPOCH`,
  capped at ~90 days (`isAllRangeCapped` → a note under the chart). No AE
  secrets → «Ingen data ennå».
- Visitor map (`GeoMap`): `public/world.svg` is built by
  `scripts/build-world-svg.mjs` (`prebuild`, from the
  `world-map-country-shapes` devDependency) and injected via
  `dangerouslySetInnerHTML` — never set a React-managed node's innerHTML by
  ref. Colours come from CSS (`.geo-map path`, `--map-empty`/`--map-stroke`
  switch on `.dark`); JS only stamps `data-v` 1/2/3 from `geoBucket` (log
  scale relative to the busiest country), so a theme toggle recolours with no
  re-run. Keep BOTH the baked grey `fill`/`stroke` and the CSS `var()`
  fallbacks — an unstyled SVG path renders black. `/api/geo` is fetched once
  (`fetchGeoCountries`, `lib/geo.ts`) for the map and the Alt total.
- Contact form: Turnstile is gated per side — the widget renders only when
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set at build time, the Worker verifies
  only when the `TURNSTILE_SECRET` secret is set (both are live in prod; a
  secret without a site key 403s every submission, so `deploy.yml` fails on
  an empty site key; with neither, the form runs on its other defences).
  Tokens are
  single-use and spent before the rate-limit/mail steps, so `ContactForm`
  resets the widget (`TurnstileHandle.reset`) after every non-OK response and
  keeps the typed text.
- TypeScript is split: app `tsconfig.json` (lib.dom), Worker
  `tsconfig.worker.json` + generated `worker-configuration.d.ts`. After any
  `wrangler.jsonc` change or wrangler bump run `npm run cf-typegen` and commit
  the result — `npm run typecheck` starts with `wrangler types --check`
  (`cf-typecheck`), which fails while the file is stale (it compares the env
  hash and the installed workerd version, so every wrangler bump trips it).

## Commands

- `npm run check` (lint + typecheck + tests) must pass before a PR;
  `npm run build` exports to `out/` (and finalizes it, above). CI and deploy
  then run `npm run check:waf` (`scripts/check-waf.mjs`): the WAF rule in
  `.github/waf/scanner-block.expr` must block no URL the build serves — and
  `npm run check:csp` (`scripts/check-csp.mjs`).
- Deploy: PR → `check` (`ci.yml`) → squash auto-merge → `deploy.yml` (a
  secret-free job runs checks + build, then a job with the `production`
  secrets syncs them, runs `npx wrangler deploy` and `scripts/smoke.sh`
  against the live site; details in `.github/CLAUDE.md`). Never deploy from a sandbox —
  it has no Cloudflare credentials and would skip the gate; `npm run deploy`
  is for a local machine with `wrangler login`.
- The merge gate is hands-off: branch protection on `main` requires `check`
  with 0 approvals (a solo repo — you can't approve your own PR). Open PRs
  *ready* with squash auto-merge: green merges and deploys, red stays open.
  To hold one for a manual look, open a draft without auto-merge.
- Remote sessions reach the internet through an agent proxy, so
  `curl https://rozsoshnykh.no/...` works for live diagnosis; the deploy gate
  is still the smoke step, not ad-hoc curl.
- Session branches: one `claude/*` branch per session, reset onto
  `origin/main` before new work (else the next PR conflicts with its own
  squashed history). Merged head branches are deleted by GitHub; only a PR
  closed unmerged leaves one to delete by hand.

## Conventions

- Front-page section pattern: mono uppercase red eyebrow
  (`text-red-500 … tracking-widest uppercase`) + bold h2 + cards
  (`bg-white dark:bg-gray-900/50 rounded-xl border … hover:border-red-500/30`),
  staggered `animate-fade-in` delays (0/150/300/450/600/750ms).
- Secondary links (footer, tag chips, the NO/EN switch) set
  `prefetch={false}`: each viewport prefetch is several requests (RSC
  payloads — asset-served, so no Worker quota, but still mobile data);
  primary nav, post cards and prev/next keep Next's default.
- Accent TEXT is red-600 in light mode / red-400 in dark; red-500 is for
  decoration only (dots, borders, selection, chart dots) — red-500 text on
  the light background fails WCAG AA. In-text links are underlined. Font is
  Intel One Mono via CSS variable.
- The 2001: A Space Odyssey theme is deliberate and load-bearing: intro
  (`HEI %USERNAME%` → stars → monolith → HAL eye), 404, `error.tsx`, the
  `HalIdle` screensaver (idle 75s on the front page, never while `#status` is
  on screen; recurring, the script shortens each appearance, CRT line reveal
  via `.hal-text-reveal`), loader copy («Åpner podbay-dørene…», «Kalibrerer
  AE-35-enheten…»), console greeting, `HISTORY_LIMIT = 149`. `%USERNAME%` is
  a literal joke, not a template var (English: `HELLO %USERNAME%`). The
  intro plays once per visitor (localStorage `intro-seen`), only on a plain
  first load of a front page, `/` or `/en/` (never under
  prefers-reduced-motion): the head script in `app/layout.tsx` marks it seen
  when a visitor lands anywhere else or on a `/#hash` deep link. Any key or
  click skips it.
- Blog posts: Norwegian in `content/blog/<slug>.md`, English in
  `content/blog/en/<slug>.md` with `translationOf: <norwegian slug>`; a post
  may exist in one language only. Frontmatter `title`, `description`, `date`
  (ISO), `tags`, optional `updated` and `draft: true`. Twins share date,
  `updated`, tags and draft — `tests/blog-pairs.test.ts` fails otherwise, so
  an edit to one updates both; `/new-post` writes both drafts. `lib/blog.ts`
  takes `lang` everywhere, URLs come from `lib/blog-paths.ts`, and one view
  counter covers both versions (`viewKey`: the Norwegian slug). Tags are
  canonical across languages (`lib/tags.ts` normalizes; canon + aliases in
  `data/tags.ts`); `TAG_LABELS_EN` gives the Norwegian-word tags their
  English label, which also forms the English tag URL. Reading time is
  computed; code blocks are highlighted at build by `rehype-highlight` (theme
  in `app/globals.css`). `draft: true` keeps a post off every public surface
  in production builds (`NODE_ENV` filter in `getPostSlugs`/`getAllPosts`);
  `npm run dev` shows drafts with a red «Utkast» badge.
- SEO: canonicals + trailing slash everywhere, OG images via `next/og`,
  JSON-LD (Person + WebSite sitewide, BlogPosting + image + BreadcrumbList per
  post), RSS at `/feed.xml` + `/en/feed.xml`, hreflang between language
  twins (pages + sitemap), prev/next + tag pages. `robots.index: false` in
  `app/layout.tsx` until launch — flip it only when asked, then submit the
  sitemap in Search Console. `/kontakt`, `/personvern` and status-style
  utility pages stay noindex permanently; the sitemap never lists noindex
  URLs.

## Gotchas

- `wrangler.jsonc`: `workers_dev: true` must stay (wrangler silently disables
  workers.dev when routes exist, which would 404 old links). workers.dev
  isn't our zone, so no edge rule can redirect it: its pages answer 200 with
  the apex canonical, its `/api/*` still 301s to the apex (accepted
  2026-10-22, when HTML left the Worker). The D1 database is `rozsoshnykh-metrics-v2`; never try to
  reclaim the old `rozsoshnykh-metrics` name — the dead original's deleted
  entry still locks it.
- `next.config.mjs` sets the experimental
  `turbopackChunking: { minChunkSize: 15000 }`: Turbopack's default (50 kB)
  copied shared client modules — Header/Footer client parts, `next/link`,
  the dictionary — into several page chunks, and viewport prefetch downloads
  the prefetched routes' chunks, so a first view fetched them 3–5 times.
  20 kB cost the no-prefetch path ~2 KB, 10 kB added 8 scripts. CI fails if
  the dictionary leaves its single chunk (a Next upgrade can drop or rename
  the experimental key with only a warning); after a Next upgrade also
  re-measure with prefetch on (Chromium, desktop + mobile) and drop the
  setting if the default stops duplicating.
- ESLint stays on 9 (with `eslint-config-next` 16's flat config); the React
  plugin it pulls in is not ESLint-10-compatible yet.
- `package.json` is NOT `"type": "module"` — that breaks the Next 16 /
  turbopack config load. Standalone Node scripts use `.mjs`.
- No R2 (it needs a card even on the free tier) and no off-platform metrics
  backup: D1 Time Travel (7 days on Workers Free; 30 is the Paid figure) is
  the only restore path, an accepted risk. Don't add a backup unless asked.
- Country flags in the GeoMap legend use a self-hosted Twemoji subset
  (`public/fonts/TwemojiCountryFlags.woff2`, `unicode-range:
  U+1F1E6-1F1FF`, class `.font-flag`) — Windows has no regional-indicator
  glyphs and would show letter pairs. The `unicode-range` keeps it from
  downloading unless a flag is on the page.
- The body font uses `display: 'optional'` (not `swap`) in `app/layout.tsx`:
  `next/font` has no metrics for Intel One Mono, so `swap` reflows the whole
  page on a cold first paint. Don't switch back without a hand-built
  metric-matched fallback `@font-face`. Keep `preload: true` with it — without
  the preload the woff2 misses `optional`'s block window and a newcomer's
  first page renders in the system monospace.
- `app/template.tsx` cross-fades client-side route changes (450ms
  `animate-page-in`) — never the document's first page, which must paint at
  once (an opacity-0 start also hid it from LCP); its wrapper keyed by
  pathname — a root template alone re-mounts only when
  the top-level segment changes, so `/blogg/` → a post wouldn't fade.
  OPACITY-ONLY — a transform would become a containing block for the
  `position:fixed` intro overlays / sticky header — and both front pages
  (`/`, `/en/`) opt out so the intro's z-100 overlay keeps a clean stacking
  context. Respects `prefers-reduced-motion`.
- In-page nav (`components/layout/HashLink.tsx`): on a front page (`/` or
  `/en/`) it intercepts links into that same page (`/#x`, `/en/#x`) with native `scrollIntoView({behavior:'smooth'})` +
  `history.pushState` (Next's `<Link href="/#x">` concatenates hashes into
  `/#main#about`; setting `location.hash` jumps past the smooth scroll). The
  header offset is pure CSS (`scroll-padding-top`) — no custom rAF scroll, it
  fights the global `scroll-behavior: smooth`. The logo is a HashLink too:
  on its front page it scrolls back to the top (Next treats `/` → `/` as a
  no-op). Everywhere else, plain `<Link>` navigation. `<html data-scroll-behavior="smooth">`
  must stay: it lets Next switch smooth scrolling off while it resets scroll
  on a route change — without it the reset animates, Next's follow-up
  `scrollIntoView` calls cancel it, and the new page opens mid-scroll. Page links set `aria-current` (`page` on an exact match, `true`
  on a parent), styled via `[&[aria-current]]:`.
- `StatusDashboard`, `GeoMap` and `TrendsChart` are code-split via
  `next/dynamic` (`ssr: false`) through `LazyStatusDashboard.tsx`,
  `LazyGeoMap.tsx` and `LazyTrendsChart.tsx`, so none is in the static HTML.
  Their headings (`Driftsstatus`, `Hvor leserne kommer fra`, `Trafikk over
  tid`) live in the server components `Status.tsx`, `Visitors.tsx` and
  `Trends.tsx` — keep them there: `smoke.sh` greps them and SEO sees the
  structure before hydration.
