# Front-end notes (components/)

Loaded when working under `components/`. Site-wide map, commands and
gotchas: root `CLAUDE.md`; the Worker behind `/api/*`: `src/CLAUDE.md`;
incident background: `docs/history.md`.

## UI conventions

- Front-page section: `home/SectionHeading.tsx` — the mono uppercase red
  eyebrow (`layout/Eyebrow.tsx`: also the page headers, the footer, the 404
  and `error.tsx`), a bold h2 and, where the section explains itself, a
  lead — then cards (`bg-white dark:bg-gray-900/50 rounded-xl border …
  hover:border-red-500/30 dark:hover:border-red-500/20 transition-all
  duration-500`) — every card, status/map/Trends included — with staggered
  `animate-fade-in` delays (150/300/450/600/750 ms). The hero (`#about`, the
  first screen) has none: an opacity-0 start delays LCP (`docs/history.md`).
  Skill chips highlight under the pointer like the blog's tag chips, though
  they are labels, not links: the owner likes it (2026-11-10) — keep it.
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
  Inline code is a chip (`.post-body`), each word a nowrap span from
  `lib/inline-code.ts`, so a phone breaks lines between words only. Table
  cells take `overflow-wrap: anywhere`: WebKit keeps hyphenated words whole,
  and a table once outgrew the iPhone screen. Ahead of it they hyphenate
  (`hyphens: auto`, by the page's lang; never inside code) — a word broken
  just anywhere read as a typo («Interne/tt») — and on a phone a table of up
  to three columns keeps each at 11ch or more (`anywhere` let auto layout
  starve the label column). SVG images (diagrams, drawn
  for the light theme) fill the column, and the dark theme inverts them
  (`invert(1) hue-rotate(180deg)`: lightness flips, hue stays).

## The 2001 theme (load-bearing)

- Intro (`effects/Intro.tsx`): `HEI %USERNAME%` (English `HELLO
  %USERNAME%`, a literal joke) → stars → monolith → HAL eye; once per visitor (localStorage `intro-seen`), only on a plain first
  load of `/` or `/en/`, never under prefers-reduced-motion. The head script
  in `app/layout.tsx` marks it seen when a visitor lands anywhere else or on
  a `/#hash` deep link. Any key or click skips it.
- `effects/HalIdle.tsx`: after 75 s idle on the front page — never while
  `#status` is on screen, the tab hidden or the window unfocused; recurring,
  the script shortens each appearance; CRT line reveal `.hal-text-reveal`.
- `effects/HalEye.tsx`: the eye itself, drawn once for the intro, the
  screensaver, the 404 and `error.tsx`; `look` picks its size and glow.
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

- The blog index shows its RSS feed as a plain `<a>` (`feedPath`): a file,
  not a page, so no `<Link>`.

## Live widgets and counters

- Every `/api/*` call is a Worker request. Shared fetches:
  `fetchGeoCountries` (`lib/geo.ts`: map + the Trends «Alt» total) and
  `fetchStatus` (`lib/status-fetch.ts`: dashboard + footer dot). The status
  dashboard, map, Trends chart and footer status dot mount and fetch only as
  they near the viewport (`useNearViewport`, `lib/use-near-viewport.ts`;
  each `Lazy*.tsx` placeholder keeps the final height). `StatusDashboard`
  polls only while `#status` is on screen; its live region is the state
  text alone. An uptime bar is colour and mouse-only titles, so it is
  `aria-hidden`. Its caption is quiet — «Siste 149 sjekker» — on the owner's
  call (2026-11-11): a visible count of old single failures («4 feilet»)
  read as an alarm on a service that was up, and the «1:4:9» aside went
  with it (`HISTORY_LIMIT` stays 149). The count stays for screen readers
  (`sr-only`: it is the hidden bar's text), and while a service is down the
  caption adds since when (`failingSince`, `src/status.ts`). "Now" is the server's (`lib/server-clock.ts`):
  `fetchStatus` and the Trends fetch note each answer's `Date` header
  (stamped by the edge on cached answers too), and the stale check and the
  chart's bucket grid use `serverNow()` — on a visitor's clock that is days
  off, a fresh snapshot read as dead and the dots fell off the grid. A gap
  under two minutes counts as none. `VisitBeacon` keeps the visitor's own
  clock: its day is theirs.
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
  `CONTACT_ADDRESS`), so the browser refuses what the Worker would. The form
  and its confirmation replace each other, so focus is moved by hand: to the
  confirmation's heading after a send, back to the name field on «Send en
  til» — the element that had it is unmounted, and focus fell to `<body>`.
  Without JavaScript the form can't send (a `fetch()` behind Turnstile), and
  a native submit was a GET with the message in the address bar: a
  `<noscript>` note gives the address, `@media (scripting: none)` hides the
  fields, `method="post"` keeps a message out of any URL. In e2e find the
  note by element — Playwright's text matching never looks inside
  `<noscript>`.
- Footer e-mail (`layout/CopyEmail.tsx`): a click copies on desktop, a tap
  opens the mail app on touch screens; its «kopiert!» live region stays
  mounted. The footer's links carry `py-3 -my-3` (the inline privacy link
  `py-3`): 40 px or more to the finger on a 16–20 px line, nothing moves.
