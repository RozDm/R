# Cloudflare security on the Free plan — zone rozsoshnykh.no

What sits in front of the Worker at the edge, what the Free plan really allows,
and what the deployed set does to this site. Read it before changing WAF,
rate limiting or bot settings, and whenever a visitor, the smoke test or the
watchdog gets a 403 or 429 the Worker didn't send (Cloudflare's own block
pages carry `X-Frame-Options: SAMEORIGIN`; the Worker's say `DENY`).

Facts verified against developers.cloudflare.com on 2026-10-16 (sources
inline); "measured" means probed live on the same day. Everything here is
**dashboard-managed** except the response-header rule, which lives in
`.github/workflows/zone-rules.yml`.

## Deployed configuration (2026-10-16)

| Layer | Where | Setting |
|---|---|---|
| WAF custom rule "scanner block" | Security → Security rules → Custom rules | 52 `http.request.uri.path contains …` patterns (below), action Block |
| Rate limiting rule | Security → Security rules → Rate limiting rules | `http.host ne ""`, 30 requests / 10 s per IP, Block, 10 s timeout, "also apply to cached assets" off |
| Bot Fight Mode | Security → Settings → Bot traffic | On |
| Block AI bots (legacy toggle) | Security → Settings → Bot traffic | On |
| Free Managed Ruleset, L3–L7 DDoS | default | On (not configurable on Free) |
| Response Header Transform `error_no_store` | `zone-rules.yml` (code) | 4xx/5xx → `Cache-Control: no-store` |

Goal of the set: keep scanner traffic off the Worker's 100,000 requests/day
(per account, resets 00:00 UTC; past it every `run_worker_first` path —
all HTML and `/api/*` — gets a 429). A request blocked at the edge never
reaches the Worker and is not counted
([Workers metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/):
"Requests blocked by WAF or other security features will not count").
Measured: `/wp-login.php`, `/.env`, `*.php` get Cloudflare's 403 without
touching the Worker — the custom rule works.

## Open problems with the deployed set (measured 2026-10-16)

1. **The rate limiting rule hits real visitors.** One fresh desktop page
   view is 38 same-origin requests in 10 s: 20 to asset-first static files,
   ~18 Worker-bound (HTML, RSC `*.txt`, `/api/*`). 4 of them got 429,
   including a `/_next/static` chunk; browsing three pages in 40 s also got
   429 on HTML. Free has no cache exclusion, so the "cached assets: off"
   toggle does nothing — every matching request counts, including the
   asset-first files that cost the Worker nothing.
2. **Bot Fight Mode blocks GitHub Actions.** It targets "simple bots from
   cloud hosting providers" and runners are Azure VMs: `status-watchdog`
   run 38900444897 got `GET / -> 403` (first failure in 51 runs). The next
   deploy's `scripts/smoke.sh` and the `zone-rules.yml` prod check curl
   from the same runners, after `wrangler deploy` has already shipped.
   Nothing on Free can except them (see Bot Fight Mode below).
3. **Bot Fight Mode fights the hash CSP.** Its JavaScript Detections loader
   is an inline `<script>` with per-request parameters, injected into the
   HTML *after* the Worker hashed the page's scripts. The browser refuses
   it on every page view, each refusal posts a CSP report to
   `/api/csp-report` (a Worker request), and the detection never runs. JSD
   also strips the HTML's ETag.
4. **`contains` is path-anywhere and case-sensitive.** Today no exported
   path matches, but a DevOps blog will: `/blogg/jenkins-pipeline/`,
   `/blogg/tag/docker-compose/`, `/blogg/solr-tuning/`, `/blogg/install.sh/`
   would all be 403'd — together with their RSC `.txt` payloads, OG image
   and `/api/views/<slug>` counter. Meanwhile `/WP-LOGIN.PHP` slips through.

Recommended fixes, in order: Bot Fight Mode **off**; rate limiting scoped
to Worker-bound paths at 60/10 s; the slug-proof custom rule. Each is below.

## Execution order

```
IP Access rules
  → [Bot Fight Mode + AI-bot blocking: separate pipeline, position vs. the phases NOT documented]
  → Single Redirects → URL normalization → URL Rewrite → Configuration / Origin Rules
  → DDoS L7
  → http_request_firewall_custom   (custom rules — Block = Cloudflare 403)
  → http_ratelimit                 (rate limiting — Block = 429, error 1015, Retry-After: 30)
  → http_request_firewall_managed  (Free Managed Ruleset)
  → [http_request_sbfm — Super Bot Fight Mode, Pro+ only, absent on Free]
  → … → Request Header Transforms → Cache Rules
  → Worker (run_worker_first paths) or Workers Static Assets (asset-first paths)
  → response: Response Header Transforms (error_no_store) — and BFM's JSD
    script is injected into HTML here, after the Worker set its CSP
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
dot and empty for trailing-slash URLs. The export only serves css, html,
ico, js, png, svg, txt, webmanifest, woff2 and xml, plus
`/.well-known/security.txt`.

Testing on Free: there is no Log action. Deploy a new rule as Managed
Challenge, watch Security → Analytics → Events, then switch to Block.
Since 2026-09-17 the Rulesets API accepts `?dry_run=true` on mutations.

### Deployed: scanner block, 52 `contains` patterns

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

### Recommended: slug-proof rewrite

Same intent, but extension checks and root-anchored `wildcard` can't match a
blog slug, and they are case-insensitive. About 1 KB:

```
(http.request.uri.path.extension in {"php" "php5" "phtml" "asp" "aspx" "ashx" "jsp" "jspx" "cgi" "pl"
  "env" "ini" "sql" "bak" "old" "orig" "swp" "conf" "cfg" "log" "yml" "yaml" "toml" "sh" "tar" "gz"
  "tgz" "zip" "rar" "7z" "db" "sqlite" "mdb" "pem" "key" "war" "jar"})
or (http.request.uri.path contains "/." and not starts_with(http.request.uri.path, "/.well-known/"))
or http.request.uri.path wildcard "/wp-*" or http.request.uri.path wildcard "/wordpress*"
or http.request.uri.path wildcard "/xmlrpc*" or http.request.uri.path wildcard "/cgi-bin/*"
or http.request.uri.path wildcard "/phpmyadmin*" or http.request.uri.path wildcard "/vendor/*"
or http.request.uri.path wildcard "/actuator*" or http.request.uri.path wildcard "/jenkins*"
or http.request.uri.path wildcard "/solr/*" or http.request.uri.path wildcard "/server-status*"
```

Minimal alternative that keeps the 52 patterns: wrap them as
`(<52 patterns>) and not ((starts_with(http.request.uri.path, "/blogg/") or
starts_with(http.request.uri.path, "/en/blog/") or
starts_with(http.request.uri.path, "/api/views/")) and
(http.request.uri.path.extension eq "" or http.request.uri.path.extension eq "txt"))`
— content pages and their RSC payloads pass, `/blogg/wp-login.php` still
blocks. Validate with `?dry_run=true` or the dashboard editor before
publishing; nested calls like `starts_with(lower(…))` are undocumented.

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
| Response | default 429 (error 1015, `Retry-After: 30`); custom response is Pro+ |

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
- **It cannot protect the 100k/day budget**: 3 req/s from one IP never
  exceeds 30 per 10 s and is 259,200 requests a day; ~1.2 req/s from one IP
  spends the whole quota. Only per-IP bursts are stopped.

Recommended rule — count only Worker-bound paths (this mirrors the
negatives of `run_worker_first` in `wrangler.jsonc`, a third copy of that
list), 60 requests / 10 s, Block:

```
not starts_with(http.request.uri.path, "/_next/static/")
and not starts_with(http.request.uri.path, "/fonts/")
and not starts_with(http.request.uri.path, "/icons/")
and http.request.uri.path ne "/world.svg"
and not starts_with(http.request.uri.path, "/cdn-cgi/")
```

Why 60: measured worst 10 s windows of Worker-bound requests from one
browser — fresh home 16, fresh blog index 17, a fast five-page click-through
18 — and `scripts/smoke.sh` sends ~40 from one runner IP in ~10 s. 60 leaves
~3× headroom for visitors (more for carrier-NAT IPs shared by several) and
~1.5× for the deploy gate. Counting static files too, the same click-through
is 64 requests, which is why the deployed 30 trips. If the Free editor
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
- **JavaScript Detections are forced on** under BFM ("automatically enabled
  and cannot be disabled",
  [JSD](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)),
  injected into HTML page views only.
- **CSP**: Cloudflare copies a nonce onto its injected script only if it can
  parse one from the CSP *response header*; it never adds a hash. With this
  Worker's hash-only `strictCsp()` (`src/csp.ts`) the loader is always
  blocked. Options: turn BFM off; add a per-request
  `'nonce-…'` to `script-src` in the Worker (undocumented whether it covers
  the snippet's inner iframe script); or send `Cache-Control: no-transform`
  on HTML (stops injection but also edge compression — this Worker fetches
  HTML identity-encoded, so pages would ship uncompressed).
  `'unsafe-inline'` is no fix: browsers ignore it when hashes are present.
- **Recommendation for this site: off.** It can't be scoped, its JSD can't
  run under the CSP, and it blinds the smoke test and the watchdog. The
  custom rule, rate limiting, the Free Managed Ruleset and the AI bot
  policies already cover the scanner traffic it would catch.

## AI bots

The legacy "Block AI bots" toggle is deprecated as of 2026-09-15. The
current control is Security → Settings → **Configure AI bot policies**
(Free since 2026-07-01): Search, Agent and Training, each Block / Block on
pages with ads / Allow (Training also Disallow, with Bot Preference Sync).
Recommended: Training = Block, Search = Allow, Agent = owner's choice.
Training covers GPTBot, ClaudeBot, CCBot, Bytespider, Amazonbot and
similar; `Google-Extended` is only a robots.txt token, not a crawler, so the
edge can't block it. Whether mixed Search+Training crawlers are blocked is
documented both ways — check Events. AI Crawl Control (`/ai` in the zone)
is a separate per-crawler product; blocking there uses one custom rule.
Source: [block AI bots](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/).

## Other Free protections

The Free Managed Ruleset runs by default after rate limiting; L3–L7 DDoS
protection is always on. IP Access rules exist on Free (country blocks are
Enterprise; Allow matches don't show in Events); 1 custom IP list. Leaked
credentials detection is on by default — its suggested rate-limit template
would take the only rate limiting rule.

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
  Management Read/Write) with `fight_mode`; `ai_bots_protection` is the
  legacy field. Set AI bot policies in the dashboard — the API's `ai_*`
  fields are described as robots.txt policy.
- Response header rule: `.github/workflows/zone-rules.yml` (phase
  `http_response_headers_transform`), the pattern to copy if the WAF rules
  move into code (the token would then need Zone WAF Write).

## Dashboard paths

- Custom rules and rate limiting: Security → Security rules
  (`/:account/:zone/security/security-rules`).
- Bot Fight Mode, AI bot policies: Security → Settings
  (`/:account/:zone/security/settings`, filter "Bot traffic").
- What got blocked and by which service: Security → Analytics → **Events**
  tab (`/:account/:zone/security/analytics`; there is no `/security/events`
  for a zone). Free shows sampled events, 31 days.
