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
surgery kit built during this incident (see CLAUDE.md for its modes — the
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
(`cacheControlFor`), so repeat visits and client-side navigations render the
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

## Removed features that must not quietly return

- **Newsletter sign-up** — removed; a dormant `subscribers` table remains in
  D1 (rows may exist in prod, nothing reads or writes it).
- **`d1-backup.yml`** — a weekly gpg-encrypted D1 dump to a GitHub artifact
  (with a `BACKUP_PASSPHRASE` secret) existed briefly and was removed as not
  worth the upkeep. D1 Time Travel (30 days, Cloudflare-side) is the only
  restore path — an accepted risk, since `views`/`geo` are cosmetic and
  `contact` rows are secondary copies of e-mails already delivered. Don't
  reintroduce a backup without being asked.
- **`geo-reset.yml`** — superseded by `reset-metrics.yml` (wipes `views` +
  `geo`, prints before/after counts).
