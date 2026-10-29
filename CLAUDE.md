# CLAUDE.md

Personal portfolio + blog for Dmytro Rozsoshnykh, live at https://rozsoshnykh.no:
a Next.js 16 static export (App Router, `output: 'export'`) served by
Cloudflare Workers static assets, plus a Worker for `/api/*`. React 19,
TypeScript 6, Tailwind v4. Norwegian (nb-NO) at the root, an English twin
under `/en/` (front page, contact, privacy, blog). Code and comments: English.

## Where the rules live

Each file loads only when a task touches its area:
- this file — site-wide map, commands, conventions, gotchas;
- `components/CLAUDE.md` — front-end internals: widgets, counters, contact
  form, theme, navigation, UI conventions;
- `src/CLAUDE.md` — the Worker: modules, bindings, the `/api/*` surface,
  serving and CSP rules, worker tests;
- `.github/CLAUDE.md` — CI/deploy and the ops workflows;
- `.claude/skills/browser-check` — Playwright recipe for a built page;
- `docs/cloudflare-security.md` — the zone's edge security (WAF, rate
  limiting, bots, owner's dashboard to-do): read before touching zone
  security or when a 403/429 isn't the Worker's;
- `docs/history.md` — incidents behind the hard rules: read only when a rule
  seems wrong or you want to undo one.

A PR that adds, moves or removes files in `src/`, `app/`, `components/` or
`lib/`, or changes the `/api/*` surface, updates the matching doc in the same
PR. `scripts/check-docs.mjs` (run by `tests/docs.test.ts`, so CI blocks)
fails when a doc names a missing path or when a Worker module, `/api/*`
route, `app/` route dir, `lib/` file, workflow, script, skill or hook is in
no doc. The Stop hook `.claude/hooks/stop-docs.mjs` runs it before a session
ends and blocks once when the branch changes that structure without
touching a doc.

## Working efficiently

Token economy is standing policy: Grep first, then read only the part you
need (`offset`/`limit`); batch independent calls; don't re-run what already
answered; keep output and replies short.

- Generated files — `worker-configuration.d.ts` (`npm run cf-typegen`),
  `package-lock.json`, `public/world.svg` (`prebuild`) — are denied to Read
  (`.claude/settings.json`), skipped by Grep/Glob (`.ignore`), binary to
  `git diff` (`.gitattributes`); `.claude/hooks/guard-bash.mjs` denies shell
  reads of them. `git diff --stat` says whether they changed.
- `npm run check` = lint + typecheck + tests. `npm run build` only when the
  change touches pages, metadata, the export or `scripts/`.
- GitHub MCP: one thing per call. PR CI → `pull_request_read`
  `get_check_runs`; the deploy → `actions_list` `list_workflow_runs`,
  `resource_id: deploy.yml`, `perPage: 1` (unpaged listings repeat every
  squashed commit message).
- After opening a PR, don't arm `send_later`: green `check` auto-merges in
  minutes and the subscription wakes the session on anything red. After the
  merge look at the deploy run once — its smoke step is the real gate.
- Commit messages: subject + a few lines. PR bodies: short bullets, what and
  why. Replies to the owner (writes Russian): outcome first, then only what
  needs their decision; no recap of the diff.

## Architecture

- `app/` + `components/` — App Router, `trailingSlash: true`, Tailwind v4
  (no config file; `@theme` in `app/globals.css`).
- Routes: `/` + `/en/` (Hero/Skills/Certifications/Status/Visitors/Trends),
  `/blogg/…` + `/en/blog/…` (index, `[slug]`, `tag/[slug]`), `/kontakt` +
  `/en/contact`, `/personvern` + `/en/privacy` (the Norwegian notice is
  authoritative — change both), `feed.xml` + `en/feed.xml`, sitemap, robots,
  manifest, OG images, `/icons/*.png` + `favicon.ico` (build-time, from
  `app/icon.svg` via `app/icons/[name]/route.tsx`; the build copies the ico
  to `/favicon.ico`), `/.well-known/security.txt` (static, RFC 9116: bump
  `Expires` yearly — `tests/static-assets.test.ts` fails 30 days ahead),
  `/status` → `/#status` (`public/_redirects`; www → apex and HTTP → HTTPS
  are the edge's, `zone-rules.yml`).
  `https://mta-sts.rozsoshnykh.no/.well-known/mta-sts.txt` is the mail
  MTA-STS policy, a Worker custom domain proxying Cloudflare Email Routing's
  (`src/routes/mta-sts.ts`). `error.tsx` / `global-error.tsx`: HAL-voiced
  «Systemfeil» boundaries.
- Languages: ALL UI copy lives in `data/i18n.ts` (`nb` defines the shape,
  `en` is typed against it, `tests/i18n.test.ts` checks parity) — never in a
  component. Exception: `app/error.tsx` reads `ERROR_COPY`
  (`data/i18n-error.ts`, spread into both): importing `DICT` there put a
  second dictionary copy on every page. Both languages share the page
  components (`HomePage`, `ContactPage`, the blog pages); server components
  take `lang` from their page, client components call `useLang()`. Page links go through
  `localePath()` (`lib/i18n.ts`); blog posts/tags pair dynamically and pass
  their twin as `Header alternate` + `pageMetadata({ languages })`.
  Bilingual data: `Localized` + `pick()`. The export always says
  `<html lang="nb">`: `scripts/finalize-export.mjs` rewrites `/en/` pages,
  `HtmlLang` follows client navigation, and the theme head script sets it on
  any `/en/` path (the one `404.html` answers `/en/` misses too and shows
  its English copy on `html[lang=en]`).
- Metadata: every page uses `pageMetadata()` (`lib/metadata.ts`; `lang: 'en'`
  sets og:locale, hreflang, the English OG card, `/en/feed.xml`). Next merges
  metadata SHALLOWLY — a page setting part of `openGraph`/`alternates` drops
  the rest. The root layout has no canonical/og:url (the 404 inherits it).
  Name, roles, titles and `THEME_BG` live in `lib/site.ts`; the contact
  address in `src/contact.ts` — never hard-code them.
- Serving: pages and files come from `out/` via the asset server — free,
  unlimited, no Worker request (`run_worker_first`: `/api/*` and the MTA-STS
  policy only). The Worker's 100k requests/day (then 429) can only take out
  `/api/*`. `scripts/finalize-export.mjs` (postbuild) bakes each page's hash
  CSP `<meta>` (`src/csp.ts`; re-checked by `npm run check:csp`), `lang="en"`,
  the body font's preload on the 404, `/favicon.ico` and the slash-less 301s
  (`out/_redirects`). Headers: `public/_headers`, equal to the Worker's set
  (`tests/static-assets.test.ts`). Details: `src/CLAUDE.md`.
- Worker (`src/`): `/api/status`, `/api/views/<slug>`, `/api/geo`,
  `/api/visit`, `/api/timeseries`, `/api/contact`, `/api/csp-report`, the
  MTA-STS policy, the crons. Stores: KV `STATUS` (uptime snapshot), D1
  `rozsoshnykh-metrics-v2` (counters, contact log), Analytics Engine
  `rozsoshnykh_metrics` (time series). Every `/api/*` call is a Worker
  request: client fetches use `cache: 'no-store'`, share a fetch two
  components need, load nothing below the fold before a reader nears it
  (`lib/use-near-viewport.ts`) and poll only what's on screen.
- Client counters (`VisitBeacon`, `ViewCounter`) count people, not page
  loads: first trusted human input, never under `navigator.webdriver`, the
  dedupe flag set BEFORE the fetch. Map and Trends hide absolute numbers
  below `MIN_PUBLIC_VISITS`. Details: `components/CLAUDE.md`.
- Contact form: Turnstile is gated per side — widget only with
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` at build, verification only with the
  `TURNSTILE_SECRET` secret; a secret without a site key 403s every POST, so
  `deploy.yml` fails on an empty key. Details: `components/CLAUDE.md`.
- TypeScript: app `tsconfig.json` (lib.dom); Worker `tsconfig.worker.json` +
  generated `worker-configuration.d.ts`. After any `wrangler.jsonc` change or
  wrangler bump run `npm run cf-typegen` and commit it — `npm run typecheck`
  starts with `wrangler types --check`, which fails on a stale file.

## Commands

- `npm run check` must pass before a PR. `npm run build` exports to `out/`
  and finalizes it. CI and deploy then run `npm run check:waf` (the WAF rule
  `.github/waf/scanner-block.expr` blocks no URL the build serves —
  `scripts/check-waf.mjs`), `npm run check:csp` (`scripts/check-csp.mjs`),
  `npm run check:dict` and `npx wrangler deploy --dry-run` (bundle + config,
  no credentials).
- `npm run test:e2e` (Playwright, `playwright.config.ts`, `e2e/`): user
  flows, axe in both themes, no console error or CSP violation, on desktop
  and mobile Chromium and an iPhone (WebKit, over HTTPS — see
  `scripts/serve-out.mjs`). Needs a build; serves `out/` with `/api/*`
  stubbed from `e2e/api-stub.ts`, which `tests/worker/api-stub.test.ts`
  holds to the real handlers (a route change updates the stub). CI builds
  with Cloudflare's public test Turnstile key and the fixtures fake its
  script; locally build with
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` or the widget
  tests skip (never in CI). A UI change that breaks a selector updates the
  test in the same PR. `@playwright/test` and `playwright-core` stay pinned
  to one version.
- Deploy: PR → `check` (`ci.yml`) → squash auto-merge → `deploy.yml`:
  secret-free checks + build, then the `production` job syncs secrets, runs
  `npx wrangler deploy` and `scripts/smoke.sh`, and `wrangler rollback`s
  (code and pages) when smoke fails. Never deploy from a sandbox (no
  credentials, skips the gate); `npm run deploy` is for a machine with
  `wrangler login`.
- Merge gate: `main` requires `check`, 0 approvals; it binds non-admins only
  and sessions act as the owner — never merge by hand past a red or pending
  `check`. Open PRs ready with squash auto-merge; to hold one, a draft
  without auto-merge.
- Remote sessions reach the internet through a proxy: curl to
  `https://rozsoshnykh.no/...` works for diagnosis (the gate is still smoke).
  Probe TLS with `curl --tls-max`, not `openssl s_client` (that bypasses the
  proxy).
- Session branches: one `claude/*` branch per session, reset onto
  `origin/main` before new work (else the next PR conflicts with its own
  squashed history).

## Conventions

- UI conventions (section pattern, accent colours, prefetch, theme): see
  `components/CLAUDE.md`. Font: Intel One Mono via CSS variables.
- The 2001: A Space Odyssey theme is deliberate and load-bearing — intro,
  404, `error.tsx`, the `HalIdle` screensaver, loader copy, console greeting,
  `HISTORY_LIMIT = 149` (1:4:9). `%USERNAME%` is a literal joke, not a
  template var. Details: `components/CLAUDE.md`.
- Blog posts: Norwegian `content/blog/<slug>.md`, English
  `content/blog/en/<slug>.md` with `translationOf: <norwegian slug>`; one
  language only is fine. Frontmatter `title`, `description`, `date` (ISO),
  `tags`, optional `updated`, `draft: true`. Twins share date, `updated`,
  tags and draft (`tests/blog-pairs.test.ts`); `/new-post` writes both
  drafts. `lib/blog.ts` takes `lang` everywhere, URLs come from
  `lib/blog-paths.ts`, one view counter per post (`viewKey`: the Norwegian
  slug). Tags are canonical across languages (`lib/tags.ts`; canon + aliases
  in `data/tags.ts`; `TAG_LABELS_EN` gives English labels and URLs). Code
  blocks: highlighted at build by `rehype-highlight`, palette in
  `app/globals.css` (e2e checks both themes). Images:
  `![alt](/images/<slug>/file.webp)`, file in `public/images/<slug>/`;
  `rehypePostImages` (`lib/post-images.ts`) stamps size + lazy loading and
  fails the build on an external image (the CSP's `img-src 'self' data:`
  would block it), a missing file, no alt text or an unreadable format. `draft: true` keeps a post off every public surface in
  production builds; `npm run dev` shows drafts with an «Utkast» badge.
- SEO: canonicals with trailing slashes, OG images via `next/og` (Intel One
  Mono from Fontsource WOFF, `lib/og-fonts.ts` — next/og can't read WOFF2),
  JSON-LD (Person + WebSite sitewide from `personJsonLd()` in
  `lib/metadata.ts`: `knowsAbout` from `data/skills.ts` minus the learning
  group, `hasCredential` from `data/certifications.ts` — a certificate `url`
  also makes its card a link; BlogPosting + BreadcrumbList per post), RSS per
  language, hreflang (pages + sitemap), prev/next, tag pages. Tag pages are
  noindex and out of the sitemap unless in `INDEXED_TAGS` (`data/tags.ts`) —
  add one ONLY on the owner's command. `robots.index: false` in
  `app/layout.tsx` until launch — flip it only when asked (the e2e test
  "pre-launch: every page tells search engines noindex" flips with it), then
  submit the sitemap. `/kontakt`, `/personvern` and utility pages stay
  noindex for good; the sitemap never lists noindex URLs (pre-launch
  excepted).

## Gotchas

- `wrangler.jsonc`: `workers_dev: false` and `preview_urls: false` stay
  explicit (owner's call; left out, wrangler turns workers.dev back on). The
  D1 database is `rozsoshnykh-metrics-v2`; never reclaim the old name.
- `next.config.mjs` sets the experimental `turbopackChunking: { minChunkSize:
  15000 }` so shared client modules aren't copied per page chunk
  (`docs/history.md`); `npm run check:dict` fails if the dictionary leaves
  its single chunk. After a Next upgrade, re-measure with prefetch on and
  drop the setting if the default stops duplicating.
- ESLint stays on 9 (the React plugin isn't ESLint-10-ready). TypeScript
  stays on 6: 7.0.2 (tried 2026-10-29) builds, but has no JS API, so
  typescript-eslint refuses it (tracked for 7.1+, typescript-eslint#10940),
  for ~3 s saved — not worth the npm-alias setup. Revisit when it supports 7.
- `package.json` is NOT `"type": "module"` (breaks the Next/turbopack config
  load); standalone Node scripts are `.mjs`.
- No R2 (needs a card) and no off-platform backup: D1 Time Travel (7 days on
  Free) is the only restore path, an accepted risk.
- Body font (`lib/fonts.ts`): Intel One Mono self-hosted from
  `@fontsource-variable/intel-one-mono` through `next/font/local` — the
  build needs no network (a Google-font build fails offline). Four subset
  families with their own `unicode-range`, all in the stack in
  `app/globals.css`; Turbopack names each family after its const, so never
  rename one through `declarations` (the variable keeps the const's name).
  `display: 'optional'` + `preload: true` (no late swap, no reflow; the
  preload makes a first visit catch the block window) and
  `adjustFontFallback: false`. `finalize-export.mjs` copies the preload to
  the 404 (the build fails if `index.html` has none).
- `app/template.tsx` cross-fades client-side route changes (450 ms,
  OPACITY ONLY — a transform would trap the fixed intro overlays and sticky
  header), never the document's first page (LCP); keyed by pathname; both
  front pages opt out (the intro's overlay); honours reduced motion.
- `StatusDashboard`, `GeoMap` and `TrendsChart` are code-split (`Lazy*.tsx`,
  `ssr: false`) and mount near the viewport; their headings (`Driftsstatus`,
  `Hvor leserne kommer fra`, `Trafikk over tid`) stay in the server
  components `Status.tsx`, `Visitors.tsx`, `Trends.tsx` — `smoke.sh` greps
  them.
