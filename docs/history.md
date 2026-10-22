# Incident history — the "why" behind the hard rules

Background for the rules in `CLAUDE.md` and `src/CLAUDE.md`. Nothing here is
needed for day-to-day changes; read this when a rule looks wrong or you are
tempted to undo one.

## 2026-07-03 — the D1 database died (and ghost-locked its name)

The original metrics database (`rozsoshnykh-metrics`) died server-side on
Cloudflare's end: from ~2026-06-29 every operation returned internal error
7500 ("Internal error while starting up D1 DB storage caused object to be
reset"), including Time Travel — so no restore was possible. The replacement
is `rozsoshnykh-metrics-v2`.

The deleted entry still ghost-locks the old name: `d1 list` shows it, every
call against its uuid 7404s, and `d1 create rozsoshnykh-metrics` answers
"already exists". Don't try to reclaim the old name. `d1-repair.yml` is the
surgery kit built during this incident (see `.github/CLAUDE.md` for its modes — the
`create` mode exists specifically because the ghost entry defeats any
"already exists" check).

Fallout that shaped other rules:

- During the outage the D1 `geo`/`views` upserts failed **silently** (swallowed
  by `.catch(() => {})`) while Analytics Engine kept collecting — the Trends
  card showed visits the map could never have. That is why `METRICS_EPOCH`
  exists: AE is append-only and can't be wiped, so a UTC epoch string filters
  out pre-relaunch points client-side and both surfaces restart together.
  The first real post-relaunch visit was 18:00 UTC on 2026-07-03, hence the
  epoch value.
- The read side hid it too: `/api/geo` swallowed the failed read and answered
  an empty map with a 200, which the site showed as "no visitors yet" and
  `smoke.sh` took for health; the watchdog only reads the KV snapshot. Since
  2026-10-22 a failed read is a 503 and `status-watchdog.yml` probes
  `/api/geo` hourly — a dead D1 now e-mails the owner within the hour.

## Why METRICS_EPOCH must sit on a 6-hour UTC boundary

The epoch filter compares against the bucket-START key
(`parseSeriesResponse`), and the 30d/Alt views bucket by 6h
(`toStartOfInterval(timestamp, INTERVAL '6' HOUR)`). With a mid-bucket epoch
(the old 17:00), a straddling bucket's start key (12:00) sorts before the
epoch, so the whole 12:00–18:00 bucket is dropped on 30d — including real
post-epoch visits inside it — and the chart undercounts the map by that
bucket. On a 6h boundary (00/06/12/18) the epoch aligns with every range's
buckets (hourly ranges divide 6h evenly), so nothing straddles. The invariant
is now guarded by a unit test in `tests/timeseries.test.ts`; when bumping
after a `reset-metrics` run, round UP to the next boundary so no pre-reset
noise slips in.

## The font reflow (why Intel One Mono is `display: 'optional'`)

`next/font` ships no metrics for Intel One Mono, so `adjustFontFallback`
can't synthesise a size-adjusted fallback — the build emits no
"Intel One Mono Fallback" @font-face. With `display: 'swap'` the page laid
out in the system monospace and then **reflowed** when the web font arrived:
a visible text-jerk on every cold first paint. `optional` blocks briefly and,
if the font isn't ready, keeps the fallback for that paint and never swaps
late — no layout shift ever. The font is immutably cached
(`public/_headers`), so repeat visits and client-side navigations render the
real font with no shift; only a cold first paint may briefly use system mono.
Don't switch back to `swap` without first adding a hand-built metric-matched
fallback @font-face.

## The all-black world map

Two prod incidents shaped the GeoMap rules:

1. Injecting the SVG by touching a React-managed node's `innerHTML` via a ref
   crashed prod (React reconciles against DOM it no longer recognises). The
   SVG goes in via `dangerouslySetInnerHTML` instead.
2. An SVG `<path>` whose `fill` resolves to nothing defaults to **black**.
   When the paths relied on bare `var(--map-empty)` (no fallback), the map
   flashed — and on some paints stuck — fully black before the CSS variables
   resolved. The fix is belt-and-suspenders: `build-world-svg.mjs` bakes a
   grey `fill`/`stroke` presentation attribute onto every path AND the CSS
   keeps `var()` fallbacks. Presentation attributes sit below CSS in the
   cascade, so the theme vars and `data-v` intensity rules still win — don't
   strip either half.

## 2026-10-04 — the contact form's time windows were really "today"

`contact.at` is written as an ISO string (`2026-10-04T18:00:00.000Z`), but
the rate-limit, duplicate and prune queries compared it with SQLite's
`datetime('now', '-10 minutes')`, which yields `2026-10-04 17:50:00`. As
TEXT the two agree up to the date, then `'T'` (0x54) sorts after the space
(0x20) — so every row from the current UTC day counted as "recent":

- the 2-minute duplicate check matched a same-day resend of the same
  message and answered `{"ok":true}` without mailing it;
- "3 per IP per 10 minutes" and "2 per address per hour" were per-day caps.

It survived because the route had no tests and the bug only shows with
real SQL. Fix: windows are ISO cutoffs computed in JS (`CONTACT_WINDOWS_MS`,
`isoCutoff`) and bound as parameters. The route tests in `tests/worker/`
run against real SQLite with the production schema, and three of them fail
on the old queries.

## 2026-10-15 — static 404s became year-long (`public/_headers` + deploy race)

#165 moved `/_next/static/*`, `/fonts/*`, `/icons/*` and `/world.svg` off
the Worker (free-plan request budget) and gave them their cache through
`public/_headers`. The asset server applies `_headers` by path to every
response it gives there, including a miss: a missing chunk came back 404
with `public, max-age=31536000, immutable`, and Chrome and Safari keep
that 404. A deploy propagates edge by edge (the first post-#165 smoke run
hit the old version 10 s after `wrangler deploy`), so a visitor can get the
new HTML and then a new chunk from an edge that doesn't have it yet — and
keep a non-hydrating page until a hard reload. Rare at this traffic, but
`_headers` can't match on status. Fix: a zone Response Header Transform
Rule sets `no-store` on every 4xx/5xx, kept as code in
`.github/workflows/zone-rules.yml`. Write it `ge 400`, never `ne 200`: a
304's headers update the stored 200, so matching 304s would strip
`immutable` from every cached chunk and the font.

## 2026-10-17 — the legacy "Block AI bots" field is not a separate switch

`zone-rules.yml` first tried to retire the deprecated toggle with
`PUT /zones/{id}/bot_management {"ai_bots_protection":"disabled"}` (since
2026-09-15 Cloudflare says its block also stops Googlebot, Bingbot and
Applebot). The API also reset `ai_training` from `disallow` to `disabled`
— AI training crawlers allowed — and the workflow's own "nothing else
moved" check stopped the run (38992445763). The next run (38992547397) set
`ai_training: disallow` back, which left `ai_bots_protection` at
`disabled`: the coupling is one way. Training crawlers were let through for
about a minute. Rule: write only `ai_training` (the workflow owns
`disallow`), never `ai_bots_protection`.

## 2026-10-17 — Web Analytics: a dead token and a second, injected beacon

The owner's console showed `POST https://cloudflareinsights.com/cdn-cgi/rum`
→ 404 plus a CORS error. Probed with curl: the token hard-coded in
`app/layout.tsx` (issued in June, likely for the old workers.dev site) was
unknown to the collector — the same 404 as an all-zero fake token, while
four public sites' tokens got 204 for the same minimal Web Vitals body. The
CORS line was only a side effect: Cloudflare's 404 page has no
`Access-Control-Allow-Origin` (the preflight passed). Meanwhile the zone's
own Web Analytics site was in automatic mode: for any `Accept: text/html`
request the edge injected a second `beacon.min.js` (another token) after the
Worker and dropped the HTML ETag. Only the first beacon to run on a page
reports; in the default "excluding EU visitors" mode a visitor in Norway
gets no injected one, so the dead manual beacon was all that ran. Web
Analytics duplicated `/api/visit` anyway, so it was removed: the snippet,
both `cloudflareinsights` CSP hosts and the privacy-notice paragraph went,
the owner disables the site in the dashboard, and `smoke.sh` ("no edge
script") fails while HTML served to a browser carries an injected script.

## 2026-10-22 — secrets, HTML off the Worker, and the ETag that vanished

Audit follow-up, three lessons that became rules:

- **A misnamed environment secret falls back silently.** Secrets moved from
  repository level to the `production` environment. The deploy token was
  saved there as `CW_API_TOKEN`; the workflows read `CLOUDFLARE_API_TOKEN`,
  which still existed at repo level, so deploy and `d1-repair` ran green on
  the *old* token and nothing flagged it. Caught only by reading the
  secret list before deleting the repo-level ones. Also learned: smoke never
  proved `AE_API_TOKEN` or `TURNSTILE_SECRET` — `/api/timeseries` answers
  200 with empty points on an AE error, and Turnstile isn't exercised — so a
  new value is verified by `analytics-report` and one real form message.
  Rule: no repository-level secrets (`.github/CLAUDE.md`).
- **HTML left the Worker.** `run_worker_first: ["/api/*"]`; each page's hash
  CSP is baked in at build as a `<meta>` (`scripts/finalize-export.mjs`).
  Measured in `wrangler dev`: with a selective `run_worker_first` a miss gets
  the 404 page and never reaches the Worker, navigation or not (the docs'
  "non-navigation misses invoke the Worker" didn't hold), so only `/api/*`
  spends quota. Chromium reports `report-to` violations from a `<meta>`
  policy exactly as from a header. The `<meta>` goes after the charset: a
  ~1 KB policy ahead of it pushed `<meta charset>` past the first 1,024
  bytes, and the asset server sends `text/html` without a charset.
- **The pages lost their ETag.** Worker-served HTML had kept the asset
  server's ETag; asset-served HTML came back without one, so every view
  re-downloaded the page instead of a 304. Cloudflare strips a strong ETag
  from HTML when Automatic HTTPS Rewrites, Email Obfuscation or Replace
  insecure JS libraries may rewrite it — features that could also break a
  page's baked hashes. `zone-rules.yml` turns all three off and its prod
  check wants `/` to answer `If-None-Match` with a 304.

## Removed features that must not quietly return

- **Cloudflare Web Analytics** — removed 2026-10-17 (above). Visits are
  counted by `/api/visit`; bringing RUM back means a CSP host, a privacy
  paragraph and a manual snippet whose token is checked live — never the
  automatic setup, which injects after the Worker.

- **Newsletter sign-up** — removed. Its leftover `subscribers` table was
  confirmed empty and dropped from prod on 2026-10-04 (`d1-repair` sql mode),
  then removed from `schema/metrics.sql`. A newsletter that comes back needs
  its own schema, consent flow and a line in `/personvern`.
- **`d1-backup.yml`** — a weekly gpg-encrypted D1 dump to a GitHub artifact
  (with a `BACKUP_PASSPHRASE` secret) existed briefly and was removed as not
  worth the upkeep. D1 Time Travel (7 days on Workers Free, Cloudflare-side;
  this note said 30 — the Paid figure — until 2026-10-16) is the only
  restore path — an accepted risk, since `views`/`geo` are cosmetic and
  `contact` rows are secondary copies of e-mails already delivered (a send
  that fails deletes its row, so every stored row was mailed). Don't
  reintroduce a backup without being asked.
- **`geo-reset.yml`** — superseded by `reset-metrics.yml` (wipes `views` +
  `geo`, prints before/after counts).
