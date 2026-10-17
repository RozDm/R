# Cloudflare security on the Free plan — zone rozsoshnykh.no

What sits in front of the Worker at the edge, what the Free plan really allows,
and what the deployed set does to this site. Read it before changing WAF,
rate limiting or bot settings, and whenever a visitor, the smoke test or the
watchdog gets a 403 or 429 the Worker didn't send (Cloudflare's own block
pages carry `X-Frame-Options: SAMEORIGIN`; the Worker's say `DENY`).

Facts verified against developers.cloudflare.com on 2026-10-16 (sources
inline); "measured" means probed live on the same day. Everything here is
**dashboard-managed** except what `.github/workflows/zone-rules.yml` applies:
the "Block scanners" WAF rule, the response-header rule, the JavaScript
Detections switch and the zone settings marked "code" below. The same run fails on dashboard bot settings
that would block search engines or CI.

## Deployed configuration (final, 2026-10-16)

| Layer | Where | Setting |
|---|---|---|
| WAF custom rule "Block scanners" | `zone-rules.yml` (code: `.github/waf/scanner-block.expr`, PATCHed in place — applied 2026-10-17, run 38992597687, replacing the dashboard rule "Security rules для rozsoshnykh.no"; `scripts/check-waf.mjs` guards it in CI) | ~3.7k chars: extension list + dot-segment clause + global `*.php/*` and `*/wlwmanifest.xml` + word wildcards that skip `/blogg/`, `/en/blog/`, `/api/views/`, `/_next/static/` (below), Block — 1 of 5 rules used |
| Rate limiting rule | Security → Security rules → Rate limiting rules | 60 requests / 10 s per IP, Block, 10 s timeout; counts every path except the asset-first static prefixes (below) |
| Bot Fight Mode | Security → Settings → Bot traffic | **Off** (see "Lessons") |
| JavaScript Detections | `zone-rules.yml` (code; no dashboard switch on Free) | **Off** — `enable_js: false` (lesson 3) |
| AI bot policies | Security → Settings → Configure AI bot policies | Training **Disallow** (`ai_training: disallow`), Search and Agent Allow, Bot Preference Sync on (read 2026-10-16); `zone-rules.yml` owns Training = Disallow. The deprecated legacy toggle (`ai_bots_protection`) is off since 2026-10-17 — and must never be written: writing it `disabled` also reset Training to Allow for a minute (`docs/history.md`). GPTBot/ClaudeBot/CCBot UAs get Cloudflare's 403 (measured; Check prod probes GPTBot). `zone-rules.yml` fails if Search becomes Block (see "AI bots") |
| Browser Cache TTL | `zone-rules.yml` (code) | Respect Existing Headers (`browser_cache_ttl: 0`) |
| 0-RTT | `zone-rules.yml` (code) | On — early data is GET/HEAD/OPTIONS only, every write here is a POST |
| Minimum TLS | dashboard; `zone-rules.yml` only raises it to 1.2 if lower | **1.3** (measured 2026-10-16: TLS 1.2 refused) — clients without TLS 1.3 (old Android/Java/OpenSSL 1.0 bots) can't connect; 1.2 is the wider-reach choice |
| Certificate Transparency Monitoring | SSL/TLS → Edge Certificates (dashboard; the API needs SSL and Certificates: Edit, which the token lacks) | owner to switch on + add an e-mail (see "Owner to-do") |
| Browser Integrity Check | Security → Settings | on by default per the docs, which say it challenges requests without a User-Agent — yet an empty-UA request got 200 (measured); its actual state is unverified, so don't rely on it |
| Free Managed Ruleset, L3–L7 DDoS | default | On (a custom rule with Skip → All managed rules can exempt a false positive) |
| Response Header Transform `error_no_store` | `zone-rules.yml` (code) | 4xx/5xx → `Cache-Control: no-store` |
| Web Analytics (RUM) | account → Web Analytics → rozsoshnykh.no → Manage site (dashboard; the CI token has no account Analytics scope) | **Disable** (owner to-do below). Its automatic setup injects a second beacon into browser HTML after the Worker and strips the ETag; the site counts visits itself (`/api/visit`). The CSP no longer lists `cloudflareinsights`, so a returning injection is refused, and `smoke.sh` ("no edge script") fails on it (`docs/history.md`) |

The `CLOUDFLARE_API_TOKEN` secret (a user-owned token) has Zone Read +
Transform Rules Edit + Bot Management Edit + Zone Settings Edit + Zone WAF
Edit — no SSL and Certificates, and no account-level Notifications, so CT
Monitoring and Notifications stay dashboard work.

Goal of the set: keep scanner traffic off the Worker's 100,000 requests/day
(per account, resets 00:00 UTC; past it every `run_worker_first` path —
all HTML and `/api/*` — gets a 429). A request blocked at the edge never
reaches the Worker and is not counted
([Workers metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/):
"Requests blocked by WAF or other security features will not count").
Measured: `/wp-login.php`, `/.env`, `*.php` get Cloudflare's 403 without
touching the Worker — the custom rule works. With Bot Fight Mode off, the
watchdog from GitHub runners is green again (run 38910824580).

## Owner to-do (dashboard only — the CI token can't do these)

Open as of 2026-10-17; tick them off here when done.

- [ ] **Certificate Transparency Monitoring** — SSL/TLS → Edge Certificates →
  Certificate Transparency Monitoring → On, add an e-mail. Mails when a CA
  outside Cloudflare logs a certificate for the zone (mis-issuance, a hijack).
  Free on every plan. (API: `PATCH /zones/{id}/ct/alerting {"enabled":true}`
  needs SSL and Certificates: Edit — deliberately not on the CI token.)
- [ ] **Notifications** (account level: Notifications → Add), e-mail to the
  owner. All on Free:
  - HTTP DDoS Attack Alert (`dos_attack_l7`);
  - Universal SSL Alert (`universal_ssl_event_type`) and Advanced Certificate
    Alert (the www custom-domain certificate);
  - Incident Alerts, filtered to Workers, Workers Assets, Workers KV, D1,
    Email Routing, Turnstile, SSL Certificate Provisioning, Authoritative DNS;
  - Abuse Report (`abuse_report_alert`) and Trust & Safety new-block
    notification (a false phishing block of a URL);
  - Security Insights.
  Free has no alert for the Workers 100k/day limit.
- [ ] **AI bot policies** — Security → Settings → Configure AI bot policies:
  confirm Training = "Disallow AI training" (never "Block": it stops
  Googlebot), Search and Agent Allow; then Security → Events, filtered to
  verified search crawlers, should show no blocks of Googlebot/Bingbot.
- [ ] **Web Analytics off** — account → Web Analytics → the `rozsoshnykh.no`
  site → Manage site → **Disable** (delete any other site there, e.g. an old
  `d.rozsoshnykh.workers.dev` one). Check: `curl -s -H 'Accept: text/html'
  https://rozsoshnykh.no/ | grep -c data-cf-beacon` prints 0. Until then each
  page view the edge injects into is one refused script, one CSP report and
  a red "no edge script" smoke check.

## Lessons from rolling it out (2026-10-16)

1. **Rate limiting at 30/10 s, counting everything, 429'd real visitors.**
   One fresh desktop page view is 38 same-origin requests in 10 s (20 to
   asset-first static files); 4 got 429, including a `/_next/static` chunk,
   and three quick page views 429'd HTML. Free has no cache exclusion, so
   the "also apply to cached assets: off" toggle does nothing — every
   request matching the expression counts, asset-first files included (they
   never touch the Worker; the toggle simply isn't honoured on Free). Fix:
   exclude static files in the expression and raise the threshold to 60.
2. **Bot Fight Mode blocked GitHub Actions.** It targets "simple bots from
   cloud hosting providers" and runners are Azure VMs: `status-watchdog`
   run 38900444897 got `GET / -> 403`; `scripts/smoke.sh` and the
   `zone-rules.yml` prod check curl from the same runners. Free has no
   exception for it (see below). Fix: off. On Free, don't use Bot Fight
   Mode on a site whose CI or monitoring are automated clients.
3. **Bot Fight Mode fights the hash CSP.** Its JavaScript Detections loader
   is an inline `<script>` with per-request parameters, injected *after*
   the Worker hashed the page's scripts; the browser refuses it on every
   page view and each refusal posts a CSP report to `/api/csp-report` (one
   Worker request); it also strips the HTML's ETag, so pages lose 304s.
   Switching BFM off did not stop it: the bot config read
   `fight_mode: false, enable_js: true` — on Free, JSD is its own flag,
   which BFM turned on and left on. The docs give Free no JSD switch ("for
   Bot Fight Mode customers … automatically enabled and cannot be
   disabled"), but `enable_js` is in the API's Bot Fight Mode config schema
   and is honoured: `zone-rules.yml` (run 38961178068, 2026-10-16) PUT
   `{"enable_js": false}`, no other field moved, and within 10 s the
   loader was gone and HTML had its ETag back, still zstd-compressed.
   (`jsd_api_results_enabled` is a different field — whether results
   submitted through the JSD API are used — not the injection switch.)
   Rejected alternatives: `Cache-Control: no-transform` on HTML also stops
   edge compression (`/` 83 KB instead of ~10 KB); a CSP nonce makes the
   loader run instead of removing it.
4. **`contains` is path-anywhere and case-sensitive.** Today no exported
   path matches the 52 patterns, but a DevOps blog will: `/blogg/jenkins-pipeline/`,
   `/blogg/tag/docker-compose/`, `/blogg/solr-tuning/`, `/blogg/install.sh/`
   would all be 403'd — with their RSC `.txt` payloads, OG image and
   `/api/views/<slug>` counter. Meanwhile `/WP-LOGIN.PHP` slips through.
   The extension-like patterns hide a second trap: Next names a page's RSC
   payload after its route, so `contains ".pl"` already 403s
   `/planer/__next.planer.__PAGE__.txt` (measured) — and `.py`, `.php`,
   `.old`, `.bak`, `.orig`, `.rb`, `.asp`, `.jsp`, `.cgi`, `.swp` do the
   same to any future page whose name starts with those letters (`/python/`,
   `/bakgrunn/`, `/en/origins/`…). Fix: the slug-safe rule below, which
   tests `.extension` (only what follows the last dot: "txt" there) and
   keeps its word patterns off the blog paths. That safety holds **only
   under the exempt prefixes**: a new section that carries slugs
   (`/prosjekter/<slug>/`) or an `/api/*/<slug>` route (`/api/likes/<slug>`)
   must be added to the exemptions. `scripts/check-waf.mjs` catches a
   blocked built page (it reads `out/`), not a new API route.
5. **Exclude static files by path prefix, not by extension.** The second
   version excluded any path *containing* `.js`, `.png`, `.svg`… (and kept
   `http.host ne ""`). But only real files under `/_next/static/`,
   `/fonts/`, `/icons/` and `/world.svg` skip the Worker: `/x.png` or
   `/blogg/a.css` is a Worker request (measured: 404 with the Worker's
   `X-Frame-Options: DENY`) the rule never counted, so a flood could append
   an extension and bypass it. Replaced the same day by the prefix
   expression below; a fresh page view then got no 429 (39 requests in 10 s,
   22 of them static). `/favicon.ico`, `/icon.svg`, `/robots.txt`,
   `/sitemap.xml`, the feeds, the manifest, OG images and RSC `*.txt` are
   Worker-served here and must stay counted.

## Execution order

```
IP Access rules
  → [Bot Fight Mode: separate pipeline, position vs. the phases NOT documented; Block AI bots is an auto-updating managed rule whose phase isn't named]
  → Single Redirects → URL normalization → URL Rewrite → Configuration / Origin Rules
  → DDoS L7
  → http_request_firewall_custom   (custom rules — Block = Cloudflare 403)
  → http_ratelimit                 (rate limiting — Block = 429, error 1015)
  → http_request_firewall_managed  (Free Managed Ruleset)
  → [http_request_sbfm — Super Bot Fight Mode, Pro+ only, absent on Free]
  → … → Request Header Transforms → Cache Rules
  → Worker (run_worker_first paths) or Workers Static Assets (asset-first paths)
  → response: Response Header Transforms (error_no_store) — and, when
    `enable_js` is on, the JSD loader is injected into HTML here, after the
    Worker set its CSP (off since 2026-10-16 — lesson 3)
```

Sources: [phases list](https://developers.cloudflare.com/ruleset-engine/reference/phases-list/)
("The phases execute in the order they appear in the table"),
[feature interoperability](https://developers.cloudflare.com/waf/feature-interoperability/),
[Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/).
A popular summary puts Bot Fight Mode first; the docs only say it runs
outside the phase system and that a matching IP Access rule prevents it.

## WAF custom rules on Free

| | Free |
|---|---|
| Rules per zone | 5 (AI Crawl Control blocks use one of them) |
| Zone custom rulesets | 1; account-level rulesets are Enterprise |
| Actions | all except Log (Enterprise) |
| Regex (`matches`) | no — Business+ |
| Fields | no per-plan list: path, `http.request.uri.path.extension`, host, `ip.src`, country, ASN, user agent, method, `cf.client.bot` all work |
| Functions/operators | `starts_with()`, `ends_with()`, `lower()`, `in {…}`, `wildcard` — no plan gate |
| Gated | `matches` (Business+), `is_timed_hmac_valid_v0` (Pro+), `cf.bot_management.*`, `cf.waf.score` (Enterprise) |
| Expression size | 4,096 characters |
| Block response | Cloudflare's standard 403 (custom response is Pro+) |

Source: [custom rules](https://developers.cloudflare.com/waf/custom-rules/),
[operators](https://developers.cloudflare.com/ruleset-engine/rules-language/operators/),
[functions](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/).
"Path and Verified Bot only" is the Free row of the **rate limiting** table,
not of custom rules.

Semantics that matter here: `contains` and `eq` are case-sensitive;
`wildcard` is case-insensitive and matches the whole path (so it is
root-anchored); `http.request.uri.path.extension` is lowercased without the
dot; the docs give "" for no dot, a trailing dot or a dot-first last
segment (`/.env` → "", so only a `/.` path clause catches dotfiles), but
don't cover trailing-slash URLs like `/blogg/install.sh/` — moot while
slugs have no dot (`tests/blog-pairs.test.ts`), and `check-waf` tries every
reading. The export only serves css, html,
ico, js, png, svg, txt, webmanifest, woff2 and xml, plus
`/.well-known/security.txt`.

Testing on Free: there is no Log action. Deploy a new rule as Managed
Challenge, watch Security → Analytics → Events, then switch to Block.
Since 2026-09-17 the Rulesets API accepts `?dry_run=true` on mutations
(syntax, fields, plan entitlements, quotas; saves nothing) —
`zone-rules.yml` dry-runs the WAF rule change first.

### Deployed: slug-safe scanner block

The expression is `.github/waf/scanner-block.expr`, one condition per line.
`zone-rules.yml` folds its whitespace to single spaces, prints the rule it
replaces (the rollback copy), validates the change with `?dry_run=true` and
PATCHes the dashboard-made rule in place (found by ref `scanner_block`,
else by the name "Block scanners"). CI and deploy run
`scripts/check-waf.mjs` after the build (below). About 3.7k of 4,096
characters, 60 `wildcard`s, four parts:

1. **Extensions** — `http.request.uri.path.extension in {…}`: server-side
   code (`php`…`phar`, `asp(x)`, `jsp(a/x)`, `do`, `action`, `cgi`, `pl`,
   `py(c)`, `rb`, `sh`…), config and secrets (`env`, `ini`, `conf`,
   `config`, `yml`, `toml`, `tfstate`, `pem`, `key`…), backups, dumps and
   archives (`bak`, `old`, `orig`, `swp`, `sql`, `db`, `log`, `zip`,
   `tar`, `gz`…). Lowercased by Cloudflare, so `/WP-LOGIN.PHP` matches.
2. **Dot segments** — any path containing `/.` (`/.env`, `/.git/config`,
   `/blogg/.env`), except under `/.well-known/`, where only dot-files are
   blocked (`/.well-known/.env`).
3. **Two global patterns** — `*.php/*` (PHP path-info:
   `/index.php/api/index`) and `*/wlwmanifest.xml` (the WordPress probe,
   under any prefix, blog paths included).
4. **Word wildcards** — case-insensitive, match-anywhere (`*/wp-*`,
   `*phpmyadmin*`, `*/jenkins*`, `*/actuator*`, `*/owa*`, `*/backup*`,
   `*-console*`, `*/swagger*`…), evaluated only outside `/blogg/`,
   `/en/blog/`, `/api/views/` and `/_next/static/` (hashed chunk and font
   names could collide).

Why it can't hit a slug: post slugs (`isValidSlug`, enforced by
`tests/blog-pairs.test.ts`) and tags (`tagToSlug`) are `[a-z0-9-]`, so a
content URL's extension is "" or "txt" and it never contains `/.`; the RSC
payload names use the route's param (`$d$slug`), not the slug; and part 4
never runs under the blog prefixes. `scripts/check-waf.mjs` proves it for
the build: it evaluates the expression over every file in `out/` as a URL
(directory URLs with and without the slash, RSC names with `$` and `%24`),
the Worker routes, `/api/views/<viewKey>` for every post and the
`smoke.sh` paths — none may be blocked — and over a must-block list of
scanner paths, under 3 normalization models (RFC 3986, Cloudflare, and the
measured mix: a literal `\` acts as `/`, `//` kept) × 3 readings of the
extension for a trailing slash, after a self-test against the docs'
examples. It also fails past 4,096 characters or 64 wildcards.

Lets through, on purpose: names that could become real pages or are cheap
404s (`/login`, `/install/`, `/setup/`, `/graphql`, `/license.txt`,
`/readme.html`), rare paths left out to save characters (`/dbadmin/`,
`/jolokia/`, `/aspnet_client/`), `.php~`/`.php.txt`/`;`-suffix tricks,
and — the price of the exemption — word probes under the blog prefixes
(`/blogg/wp-admin/`; `.php` and dotfiles there are still blocked). Of a
313-path scanner corpus it blocks 251; the old rule blocked 166. Files
with a listed extension (`.sh`, `.zip`, `.yml`…) are blocked everywhere: if
the site ever offers downloads, put them under one folder and exempt it in
part 1.

Limits: 4,096 characters (the folded expression). A rule allows 64 regexes;
whether wildcards count is undocumented, so `check-waf` keeps them ≤ 64.
Whether Free accepts the whole expression (`wildcard`, `not
starts_with(…)`) is proven only by the workflow's dry run — the docs gate
neither. The zone's normalization type and the trailing-slash extension
are unconfirmed, which is why `check-waf` tries every combination.

### Rollback copy: the old 52 `contains` patterns

The dashboard version before `zone-rules.yml` took the rule over. Not
slug-safe (lesson 4). For an emergency rollback paste it into the
dashboard rule; the next `zone-rules.yml` run puts the file's expression
back.

```
(http.request.uri.path contains ".php") or (http.request.uri.path contains ".asp") or
(http.request.uri.path contains ".aspx") or (http.request.uri.path contains ".jsp") or
(http.request.uri.path contains ".cgi") or (http.request.uri.path contains ".pl") or
(http.request.uri.path contains ".py") or (http.request.uri.path contains ".rb") or
(http.request.uri.path contains ".bak") or (http.request.uri.path contains ".old") or
(http.request.uri.path contains ".orig") or (http.request.uri.path contains ".swp") or
(http.request.uri.path contains "/.env") or (http.request.uri.path contains "/.git") or
(http.request.uri.path contains "/.aws") or (http.request.uri.path contains "/.ssh") or
(http.request.uri.path contains "/.svn") or (http.request.uri.path contains "/.hg") or
(http.request.uri.path contains "/.htaccess") or (http.request.uri.path contains "/.htpasswd") or
(http.request.uri.path contains "/.DS_Store") or (http.request.uri.path contains "/.bash_history") or
(http.request.uri.path contains "/wp-") or (http.request.uri.path contains "/xmlrpc") or
(http.request.uri.path contains "/phpmyadmin") or (http.request.uri.path contains "/pma") or
(http.request.uri.path contains "/adminer") or (http.request.uri.path contains "/administrator") or
(http.request.uri.path contains "/web.config") or (http.request.uri.path contains "/phpinfo") or
(http.request.uri.path contains "/c99") or (http.request.uri.path contains "/r57") or
(http.request.uri.path contains "/.sql") or (http.request.uri.path contains "/dump.sql") or
(http.request.uri.path contains "/db.sql") or (http.request.uri.path contains "/composer.") or
(http.request.uri.path contains "/package.json") or (http.request.uri.path contains "/vendor/") or
(http.request.uri.path contains "/docker-compose") or (http.request.uri.path contains "/actuator") or
(http.request.uri.path contains "/jenkins") or (http.request.uri.path contains "/solr") or
(http.request.uri.path contains "/struts") or (http.request.uri.path contains "/cgi-bin") or
(http.request.uri.path contains "/owa/") or (http.request.uri.path contains "/install.") or
(http.request.uri.path contains "/setup.") or (http.request.uri.path contains "/autodiscover") or
(http.request.uri.path contains "/elfinder") or (http.request.uri.path contains "/fckeditor") or
(http.request.uri.path contains "/tiny_mce") or (http.request.uri.path contains "/ckeditor")
```

Groups: server-side extensions (`.php .asp .aspx .jsp .cgi .pl .py .rb`),
backups (`.bak .old .orig .swp`), dotfiles/secrets (`/.env /.git /.aws
/.ssh /.svn /.hg /.htaccess /.htpasswd /.DS_Store /.bash_history`),
WordPress (`/wp- /xmlrpc`), DB admin (`/phpmyadmin /pma /adminer
/administrator`), web shells (`/c99 /r57`), SQL dumps, package/DevOps
files, exploit targets (`/actuator /jenkins /solr /struts /cgi-bin /owa/`),
installers, Exchange (`/autodiscover`), file managers/editors.

## Rate limiting rules on Free

| | Free |
|---|---|
| Rules | 1 |
| Counting period | 10 s only |
| Mitigation timeout | 10 s only (the action lasts the whole timeout) |
| Characteristics | IP only (+ the mandatory hidden `cf.colo.id`); NAT-aware IP is Business+ |
| Fields in the expression | **Path and Verified Bot only** (Host from Pro; method, IP, UA from Business) |
| Custom counting expression | no |
| Cache exclusion | no — cached and asset-first responses always count |
| Response | default 429 (error 1015; `Retry-After: 30` per a 2026-03-12 changelog entry, not in the rate-limiting docs); custom response is Pro+ |

Source: [rate limiting availability](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/),
[request rate](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/).

- **Counters are per data center**, can lag a few seconds, and rate
  limiting fails open under load — it is a burst brake, not a quota.
- **`true` is a valid expression** in the Rules language ("When you use
  `true` as the rule filter expression … apply the rule to every incoming
  request", [rules](https://developers.cloudflare.com/ruleset-engine/about/rules/)).
  If the Free rate-limiting editor refuses it, the documented limit there is
  the field allowlist, not the literal. The deployed `http.host ne ""` uses
  Host, which the docs list from Pro: it is accepted today but outside the
  documented Free surface. Prefer a Path-only expression.
- **It cannot protect the 100k/day budget**: 5 req/s from one IP never
  exceeds 60 per 10 s and is 432,000 requests a day; ~1.2 req/s from one IP
  spends the whole quota. Only per-IP bursts are stopped.

Deployed (2026-10-16), 60 requests / 10 s per IP, Block — counts only
Worker-bound paths. The excluded prefixes are the negatives of
`run_worker_first` in `wrangler.jsonc` (plus Cloudflare's own `/cdn-cgi/`),
a third copy of that list next to `public/_headers` — change all three
together. `starts_with` is a function, not an infix operator:

```
not (
  starts_with(http.request.uri.path, "/_next/static/")
  or starts_with(http.request.uri.path, "/fonts/")
  or starts_with(http.request.uri.path, "/icons/")
  or http.request.uri.path eq "/world.svg"
  or starts_with(http.request.uri.path, "/cdn-cgi/")
)
```

Why 60: measured worst 10 s windows of Worker-bound requests from one
browser — fresh home 16, fresh blog index 17, a fast five-page click-through
18 — and `scripts/smoke.sh` sends ~40 from one runner IP in ~10 s. 60 leaves
~3× headroom for visitors (more for carrier-NAT IPs shared by several) and
~1.5× for the deploy gate. Counting static files too, the same click-through
is 64 requests, which is why the first rule (30, counting everything)
tripped. If the Free editor
rejects `starts_with()`, the same rule with operators only:
`not (http.request.uri.path wildcard "/_next/static/*" or http.request.uri.path wildcard "/fonts/*" or http.request.uri.path wildcard "/icons/*" or http.request.uri.path eq "/world.svg" or http.request.uri.path wildcard "/cdn-cgi/*")`.

Narrower alternative: `starts_with(http.request.uri.path, "/api/")` at
~20/10 s (writes are already capped per IP by the Worker's
`WRITE_LIMITER`).

## Bot Fight Mode on Free

- Opt-in, whole zone, aimed at "simple bots from cloud hosting providers
  and headless browsers"; answers with a computationally expensive
  challenge that curl and other non-JS clients can never pass.
  ([Free bots](https://developers.cloudflare.com/bots/plans/free/))
- **Not on the Ruleset Engine — cannot be skipped.** "You cannot bypass or
  skip Bot Fight Mode using WAF custom rules or Page Rules"
  ([BFM](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)).
  The one Free lever is an IP Access rule that matches first, and an IP
  Access Allow also bypasses custom rules, rate limiting and managed rules.
  Skip works only on Super Bot Fight Mode (Pro+).
- **JavaScript Detections: no dashboard switch on Free, but the API has
  one.** "For Bot Fight Mode customers, JavaScript Detections is
  automatically enabled and cannot be disabled" ([JSD](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/));
  the "JS detections" switch exists only for Super Bot Fight Mode / Bot
  Management. Injected into HTML page views only, and it strips their ETag.
  Measured here: it started when BFM was switched on, survived switching it
  off, and `enable_js: false` (API, BFM off) removed it — lesson 3.
  Turning BFM back on would likely turn it back on.
- **CSP**: Cloudflare copies a nonce onto its injected script only if it can
  parse one from the CSP *response header*; it never adds a hash. With this
  Worker's hash-only `strictCsp()` (`src/csp.ts`) the loader is always
  blocked — which is why JSD is off (`enable_js: false`, lesson 3) rather
  than allowed in. A per-request nonce would let it run;
  `Cache-Control: no-transform` on HTML stops injection but also edge
  compression (this Worker fetches HTML identity-encoded).
  `'unsafe-inline'` is no fix: browsers ignore it when hashes are present.
- **Off on this zone since 2026-10-16.** It can't be scoped and it blinded
  the smoke test and the watchdog. The custom rule, rate limiting and the
  Free Managed Ruleset already cover the scanner traffic it would catch.
  (Its JSD loader outlived it until `enable_js: false` — lesson 3.) Don't turn it
  back on without an answer for CI (an IP Access Allow for the runners isn't
  practical: GitHub's ranges are large and shared).

## AI bots

The legacy "Block AI bots" toggle is deprecated as of 2026-09-15. The
current control is Security → Settings → **Configure AI bot policies**
(Free since 2026-07-01): Search, Agent and Training, each Block / Block on
pages with ads / Allow (Training also Disallow, with Bot Preference Sync).
API fields on `/zones/{id}/bot_management`: `ai_search`, `ai_user` (Agent),
`ai_training` (`disabled` = Allow, `block`, `only_on_ad_pages`; Training
also `disallow`) and `bot_preference_sync_enabled`.
Recommended (and set): Training = **Disallow**, Search = Allow, Agent =
Allow. **Never Training = Block**: since 2026-09-15 Block also stops
Applebot, Bingbot and Googlebot — search included ("Have it both ways",
Cloudflare blog); Disallow edge-blocks the training crawlers (GPTBot,
ClaudeBot, CCBot, Bytespider, Amazonbot…) and keeps accountable mixed-use
crawlers for search. `zone-rules.yml` keeps `ai_training: disallow` and
fails on `ai_search: block`; it never writes the legacy
`ai_bots_protection` (writing it resets Training — `docs/history.md`). `Google-Extended` and `Applebot-Extended` are robots.txt tokens,
not crawlers, so the edge can't block them — and the Cloudflare-managed
robots.txt content is **not served** here (measured: `/robots.txt` is the
Worker's, `app/robots.ts`, with no prepended block despite
`is_robots_txt_managed: true`); opting them out would take a rule in
`app/robots.ts`. A spoofed Googlebot UA gets 200; whether the verified one
passes can only be seen in Security → Events (check before launch). AI Crawl Control (`/ai` in the zone)
is a separate per-crawler product; blocking there uses one custom rule.
Source: [block AI bots](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/).

## Other Free protections

The Free Managed Ruleset runs by default after rate limiting; L3–L7 DDoS
protection is always on. IP Access rules exist on Free (country blocks are
Enterprise; Allow matches don't show in Events); 1 custom IP list. Leaked
credentials detection is on by default — its suggested rate-limit template
would take the only rate limiting rule.

HSTS comes from the Worker, not the dashboard: `max-age=63072000;
includeSubDomains; preload` (`HSTS`, `src/csp.ts`) on every response it
serves, and the apex is on the browsers' preload list (hstspreload.org:
`preloaded`), so every subdomain is HTTPS-only in browsers whatever the
headers say. Leave SSL/TLS → Edge Certificates → HSTS off: a dashboard
policy with a shorter max-age or without `includeSubDomains`/`preload`
would duplicate or override the Worker's header with a weaker one, and a
preloaded domain that stops sending
`preload` can be dropped from the list. Asset-first static files carry no
HSTS header (the Worker never sees them) — harmless, the document sets it.

## API reference

- Custom rules: `GET /zones/{zone_id}/rulesets/phases/http_request_firewall_custom/entrypoint`
  (404 = no ruleset yet), then `POST /zones/{zone_id}/rulesets/{ruleset_id}/rules`
  to add one rule or `PATCH …/rules/{rule_id}` to change it. `PUT` on the
  entrypoint **replaces every rule in the phase**. Permission: Zone WAF
  Write (read: Zone WAF Read). Append `?dry_run=true` to validate.
- Rate limiting: same pattern in phase `http_ratelimit`; the limit is a
  top-level `ratelimit` object, not `action_parameters`, and the API needs
  `cf.colo.id` explicitly:
  `{"description":"…","expression":"…","action":"block","ratelimit":{"characteristics":["cf.colo.id","ip.src"],"period":10,"requests_per_period":60,"mitigation_timeout":10}}`.
  Rate limiting rules must come last in their list.
- Bot Fight Mode: `GET/PUT /zones/{zone_id}/bot_management` (Bot
  Management Read/Write) with `fight_mode`; `enable_js` is JavaScript
  Detections (applied by `zone-rules.yml`; a PUT naming one field leaves the
  rest as they were — measured); `ai_bots_protection` is the legacy field. Set AI bot policies in the dashboard — the API's `ai_*`
  fields are described as robots.txt policy.
- Response header rule and the "Block scanners" custom rule:
  `.github/workflows/zone-rules.yml` (phases
  `http_response_headers_transform` and `http_request_firewall_custom`):
  find the rule by ref, dry-run, PATCH in place; never PUT an existing
  entrypoint.

## Dashboard paths

- Custom rules and rate limiting: Security → Security rules
  (`/:account/:zone/security/security-rules`).
- Bot Fight Mode, AI bot policies: Security → Settings
  (`/:account/:zone/security/settings`, filter "Bot traffic").
- What got blocked and by which service: Security → Analytics → **Events**
  tab (`/:account/:zone/security/analytics`; there is no `/security/events`
  for a zone). Free shows sampled events, 31 days.
