# Front-end notes (components/)

Loaded when working under `components/`. Site-wide map, commands and
gotchas: root `CLAUDE.md`; the Worker behind `/api/*`: `src/CLAUDE.md`;
incident background: `docs/history.md`.

## UI conventions

- Front-page section: mono uppercase red eyebrow (`text-red-600
  dark:text-red-400 font-mono … tracking-widest uppercase`) + bold h2 +
  cards (`bg-white dark:bg-gray-900/50 rounded-xl border …
  hover:border-red-500/30 dark:hover:border-red-500/20 transition-all
  duration-500`) — every card, status/map/Trends included — with staggered
  `animate-fade-in` delays (150/300/450/600/750 ms). The hero (`#about`, the
  first screen) has none: an opacity-0 start delays LCP (`docs/history.md`).
- Accent TEXT: red-600 light / red-400 dark; red-500 only for decoration
  (dots, borders, selection, chart dots) — as text on light it fails WCAG
  AA. In-text links are underlined.
- Secondary links (footer, tag chips, the NO/EN switch) set
  `prefetch={false}` (each prefetch is several RSC requests — mobile data);
  primary nav, post cards and prev/next keep the default.
- Theme (`context/ThemeContext.tsx`): localStorage `theme` holds a
  hand-picked theme; none = follow the OS, live (`matchMedia` listener). The
  toggle flips on every click, and a pick equal to the OS's theme is not
  stored — flipping back is the way back to the OS.
- Blog code blocks: Typography's own light `pre` is dark, so `PostPage`
  gives `pre` a white block in light mode for the palette in
  `app/globals.css`; every `pre` is focusable (a long line scrolls it).

## The 2001 theme (load-bearing)

- Intro (`effects/Intro.tsx`): `HEI %USERNAME%` (English `HELLO
  %USERNAME%`, a literal joke) → stars → monolith → HAL eye; once per visitor (localStorage `intro-seen`), only on a plain first
  load of `/` or `/en/`, never under prefers-reduced-motion. The head script
  in `app/layout.tsx` marks it seen when a visitor lands anywhere else or on
  a `/#hash` deep link. Any key or click skips it.
- `effects/HalIdle.tsx`: after 75 s idle on the front page — never while
  `#status` is on screen, the tab hidden or the window unfocused; recurring,
  the script shortens each appearance; CRT line reveal `.hal-text-reveal`.
- Also: the 404 and `error.tsx` copy, loader lines («Åpner podbay-dørene…»,
  «Kalibrerer AE-35-enheten…»), the console greeting,
  `HISTORY_LIMIT = 149`.

## Navigation

- `layout/HashLink.tsx`: on a front page it intercepts links into that same
  page (`/#x`, `/en/#x`) with native `scrollIntoView({behavior:'smooth'})` +
  `history.pushState` (`<Link>` concatenated hashes, `location.hash` jumped:
  `docs/history.md`). The header offset is CSS `scroll-padding-top` — no rAF
  scroll, it fights `scroll-behavior: smooth`. The logo scrolls to the top
  on its own front page. Elsewhere, plain `<Link>`. Keep `<html
  data-scroll-behavior="smooth">`: it lets Next turn smooth scrolling off
  for its route-change reset. Page links set `aria-current` (`page` exact,
  `true` parent), styled via `[&[aria-current]]:`.

## Live widgets and counters

- Every `/api/*` call is a Worker request. Shared fetches:
  `fetchGeoCountries` (`lib/geo.ts`: map + the Trends «Alt» total) and
  `fetchStatus` (`lib/status-fetch.ts`: dashboard + footer dot). The status
  dashboard, map, Trends chart and footer status dot mount and fetch only as
  they near the viewport (`useNearViewport`, `lib/use-near-viewport.ts`;
  each `Lazy*.tsx` placeholder keeps the final height). `StatusDashboard`
  polls only while `#status` is on screen; its live region is the state
  text alone.
- `effects/VisitBeacon.tsx` (mounted by `app/layout.tsx`): one
  `POST /api/visit` per browser per local day (localStorage `visit-day`),
  sent on the first trusted human input (`lib/visit.ts`: pointer move/press,
  touch, key, wheel — never on load, never `scroll`, which a script can
  cause), never under `navigator.webdriver`. It writes the D1 `geo` row and
  an AE point: the map and Trends are two views of one dataset. `ViewCounter`
  (one per session per post) counts the same way through `onFirstHumanInput`;
  the Worker skips datacenter ASNs for both. Rule for ALL client counters:
  set the dedupe flag BEFORE the fetch (StrictMode double-invoke, remounts,
  a second tab). `e2e/site.e2e.ts` holds both to this.
- Below thresholds numbers hide: `ViewCounter` under 50 (`MIN_SHOWN`); map
  and Trends hide every absolute visit number until the all-time D1 total
  reaches `MIN_PUBLIC_VISITS` (`lib/geo.ts`) — shades and the chart's shape
  stay, and Trends says why («Samler data…»).
- Trends (`home/TrendsChart.tsx`): one Besøk metric, tabs 24t/7d/30d/**Alt**,
  dots over a zero-filled bucket grid (`lib/timeseries-fill.ts`). D1 is the
  truth for totals, AE for "when": windowed tabs show their sampled AE
  count; **Alt** shows the exact D1 total from `/api/geo`, the map's number.
  Alt's wave is 6h-bucketed from `METRICS_EPOCH`, capped at ~90 days
  (`isAllRangeCapped` → a note). No AE secrets → «Ingen data ennå»
  (`degraded`, which the watchdog fails on). The SVG's `viewBox` is its own
  rendered width (ResizeObserver) — never a fixed viewBox.
- Map (`home/GeoMap.tsx`): `public/world.svg` is built by
  `scripts/build-world-svg.mjs` and injected with `dangerouslySetInnerHTML`
  — never set a React-managed node's innerHTML by ref. Colours come from CSS
  (`.geo-map path`, `--map-empty`/`--map-stroke` switch on `.dark`); JS only
  stamps `data-v` 1/2/3 (`geoBucket`, log scale vs the busiest country), so a
  theme toggle needs no re-run. Keep BOTH the baked grey fill/stroke and the
  CSS `var()` fallbacks — an unstyled path renders black. Legend flags use a
  self-hosted Twemoji subset (`public/fonts/TwemojiCountryFlags.woff2`,
  `unicode-range` U+1F1E6-1F1FF, `.font-flag`): Windows has no flag glyphs.

## Contact form

- Turnstile tokens are single-use and spent before the rate-limit/mail
  steps: `ContactForm` resets the widget (`TurnstileHandle.reset`) after
  every non-OK response and keeps the typed text. It reads the Worker's
  `{"error"}`: only a Turnstile refusal asks for the challenge; the filter,
  an edge 429 or a widget that failed to load (`onError`: script error or
  10 s timeout) point to e-mail. The script loads once per document; a
  failed load is forgotten, so a return to the form retries and reports
  again. The widget takes the site's theme (not the OS's) and is redrawn
  when the toggle flips it. Limits, the e-mail `pattern` and the address
  come from `src/contact.ts` (`CONTACT_LIMITS`, `EMAIL_PATTERN`,
  `CONTACT_ADDRESS`), so the browser refuses what the Worker would.
- Footer e-mail (`layout/CopyEmail.tsx`): a click copies on desktop, a tap
  opens the mail app on touch screens; its «kopiert!» live region stays
  mounted.
