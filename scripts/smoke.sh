#!/usr/bin/env bash
# Post-deploy smoke test: hits the live site and fails the pipeline if the
# basics are broken. Retries tolerate cert/route propagation right after
# a deploy.
set -u

BASE="https://rozsoshnykh.no"
UA="smoke-test/1.0 (+https://rozsoshnykh.no)"
TMP=$(mktemp)
HDR=$(mktemp)
FAIL=0

fetch() { # url -> status code; body in $TMP, headers in $HDR
  curl -sS -o "$TMP" -D "$HDR" -w '%{http_code}' --max-time 20 -A "$UA" "$1" 2>/dev/null
}

check() { # name url want_status [grep_pattern...]
  local name=$1 url=$2 want=$3
  shift 3
  local code i
  for i in 1 2 3 4 5 6; do
    code=$(fetch "$url")
    [ "$code" = "$want" ] && break
    echo "  retry $i: $url -> ${code:-ERR}, want $want"
    sleep 15
  done
  if [ "$code" != "$want" ]; then
    echo "FAIL $name: $url -> $code (want $want)"
    FAIL=1
    return
  fi
  local pat
  for pat in "$@"; do
    if ! grep -qi -- "$pat" "$TMP"; then
      echo "FAIL $name: body of $url missing '$pat'"
      FAIL=1
      return
    fi
  done
  echo "OK   $name ($code)"
}

check_redirect() { # name url want_location
  local name=$1 url=$2 want=$3
  local code i
  for i in 1 2 3 4 5 6; do
    code=$(fetch "$url")
    [ "$code" = "301" ] && break
    echo "  retry $i: $url -> ${code:-ERR}, want 301"
    sleep 15
  done
  local loc
  loc=$(grep -i '^location:' "$HDR" | tr -d '\r' | awk '{print $2}')
  if [ "$code" != "301" ] || [ "$loc" != "$want" ]; then
    echo "FAIL $name: $url -> $code location='$loc' (want 301 -> $want)"
    FAIL=1
    return
  fi
  echo "OK   $name (301 -> $want)"
}

check_header() { # name url header_pattern
  local name=$1 url=$2 pat=$3
  fetch "$url" > /dev/null
  if grep -qi -- "$pat" "$HDR"; then
    echo "OK   $name"
  else
    echo "FAIL $name: $url headers missing '$pat'"
    FAIL=1
  fi
}

check_no_header() { # name url header_pattern — the header must be absent
  # Retries like check(): right after a deploy some edges still run the
  # previous version, and this is a check the old version fails.
  local name=$1 url=$2 pat=$3 i
  for i in 1 2 3 4 5 6; do
    fetch "$url" > /dev/null
    grep -qi -- "$pat" "$HDR" || break
    echo "  retry $i: $url still has '$pat'"
    sleep 15
  done
  if grep -qi -- "$pat" "$HDR"; then
    echo "FAIL $name: $url headers contain '$pat'"
    FAIL=1
  else
    echo "OK   $name"
  fi
}

check_no_edge_script() { # name url — no script injected into the HTML after the Worker
  # The hash CSP refuses any script the edge adds after the Worker; each
  # refusal is a CSP report (one Worker request per page view), and the
  # injection strips the HTML's ETag. Off in the dashboard is the only fix.
  # Web Analytics' automatic setup injects only for `Accept: text/html`
  # (fetch() sends */*; JSD injected into */* too), so ask like a browser.
  # The pattern matches injected tags only — a <script> whose attributes
  # carry data-cf-beacon or a /cdn-cgi/ src (beacon, Rocket Loader, Zaraz,
  # email-decode) or the inline JSD loader — not the bare string, which the
  # pre-2026-10-17 build carried in its RSC payload. Retried on a hit: right
  # after a deploy some edges still serve that build.
  local name=$1 url=$2 pat='<script[^>]*(data-cf-beacon|/cdn-cgi/)|/cdn-cgi/challenge-platform/' code i
  for i in 1 2 3 4 5 6; do
    code=$(curl -sS -o "$TMP" -w '%{http_code}' --max-time 20 -A "$UA" -H 'Accept: text/html' "$url" 2>/dev/null)
    [ "$code" = "200" ] && ! grep -qE -- "$pat" "$TMP" && break
    echo "  retry $i: $url -> ${code:-ERR}$( [ "$code" = "200" ] && echo ', edge-injected script present')"
    sleep 15
  done
  if [ "$code" != "200" ]; then
    echo "FAIL $name: $url -> $code (want 200)"
    FAIL=1
  elif grep -qE -- "$pat" "$TMP"; then
    echo "FAIL $name: $url carries an edge-injected script: $(grep -oE -- "$pat" "$TMP" | head -1)"
    FAIL=1
  else
    echo "OK   $name"
  fi
}

# Warm-up: right after a deploy the custom-domain TLS bindings can take a few
# minutes to propagate (curl exits with code 000 until then). Wait for the
# edge to answer at all before judging individual checks.
echo "== Warm-up =="
for i in $(seq 1 30); do
  code=$(fetch "$BASE/")
  if [ -n "$code" ] && [ "$code" != "000" ]; then
    echo "edge answering with HTTP $code after $i probe(s)"
    break
  fi
  echo "  probe $i: no TLS/HTTP yet, waiting 10s"
  sleep 10
done

echo "== Pages =="
# Home asserts noindex too: the soft launch must not accidentally start
# getting indexed before launch (flip robots in app/layout.tsx when ready).
check "home"        "$BASE/"                 200 "Dmytro Rozsoshnykh" "Driftsstatus" 'name="robots" content="noindex' '<html lang="nb"'
check "blogg"       "$BASE/blogg/"           200 "Artikler"
check "post"        "$BASE/blogg/velkommen/" 200 "Velkommen"
check "tag"         "$BASE/blogg/tag/velkommen/" 200 "Velkommen"
check "kontakt"     "$BASE/kontakt/"         200 "Kontaktskjema"
check "personvern"  "$BASE/personvern/"      200 "Personvernerklæring"
check "404"         "$BASE/finnes-ikke/"     404
# English twins (/en/): the build must set <html lang="en"> on them.
check "en home"     "$BASE/en/"              200 '<html lang="en"' "Service status" "Where readers come from" 'hrefLang="nb"'
check "en contact"  "$BASE/en/contact/"      200 '<html lang="en"' "Contact form"
check "en privacy"  "$BASE/en/privacy/"      200 '<html lang="en"' "Privacy notice"
check "en og-image" "$BASE/en/opengraph-image" 200
check "en blog"     "$BASE/en/blog/"         200 '<html lang="en"' "Articles"
check "en post"     "$BASE/en/blog/welcome/" 200 '<html lang="en"' "Welcome to the blog" 'hrefLang="nb"'
check "en tag"      "$BASE/en/blog/tag/welcome/" 200 "Welcome"
check "en rss"      "$BASE/en/feed.xml"      200 "<rss" "<language>en-GB</language>"

echo "== Machine endpoints =="
check "api/status"  "$BASE/api/status"       200 '"results"'
check "api/views"   "$BASE/api/views/velkommen" 200 '"views"'
check "api/geo"     "$BASE/api/geo"          200 '"countries"'
check "api/ts/geo"  "$BASE/api/timeseries?metric=geo&range=7d" 200 '"points"'
check "api/ts/all"  "$BASE/api/timeseries?metric=geo&range=all" 200 '"points"'
check "api/ts/view" "$BASE/api/timeseries?metric=view&range=7d" 200 '"points"'
# GET is refused on purpose (reports are POSTed by browsers): 405 proves the
# route is wired without writing a junk AE point on every deploy.
check "csp-report"  "$BASE/api/csp-report"   405 '"method not allowed"'
# /api/contact refuses an oversized body before anything else (no Turnstile,
# no D1, no mail): 40 KB against the 32 KB cap.
code=$(head -c 40000 /dev/zero | tr '\0' 'x' | curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -A "$UA" \
  -X POST -H 'Content-Type: application/json' --data-binary @- "$BASE/api/contact")
if [ "$code" = 413 ]; then echo "OK   contact 413 (oversized body)"; else echo "FAIL contact oversized body -> $code (want 413)"; FAIL=1; fi
check "robots.txt"  "$BASE/robots.txt"       200 "Sitemap: $BASE/sitemap.xml" "Disallow: /api/"
check "sitemap"     "$BASE/sitemap.xml"      200 "<loc>$BASE/blogg/"
check "rss"         "$BASE/feed.xml"         200 "<rss"
check "og-image"    "$BASE/opengraph-image"  200
check "world-svg"   "$BASE/world.svg"        200 "<svg"
check "security.txt" "$BASE/.well-known/security.txt" 200 "Contact: mailto:"
check "icon-512"    "$BASE/icons/icon-512.png" 200
check "favicon.ico" "$BASE/favicon.ico"      200
# Next exports the OG cards without an extension; public/_headers types them.
check_header "og-image png"      "$BASE/opengraph-image"                    "^content-type: image/png"
check_header "post og-image png" "$BASE/blogg/velkommen/opengraph-image"    "^content-type: image/png"

echo "== Canonical host and redirects =="
# www and plain HTTP: the edge (zone-rules.yml). Slash-less pages and
# /status: out/_redirects, so their Location is a path.
check_redirect "www"         "https://www.rozsoshnykh.no/"        "$BASE/"
check_redirect "http"        "http://rozsoshnykh.no/"             "$BASE/"
check_redirect "no-slash"    "$BASE/blogg"                         "/blogg/"
check_redirect "status"      "$BASE/status"                        "/#status"
# workers.dev is off (wrangler.jsonc): its address must not serve the site,
# whatever it answers instead. Retried — a just-disabled subdomain can keep
# answering for a while after the deploy.
off=
for i in 1 2 3 4 5 6; do
  fetch "https://d.rozsoshnykh.workers.dev/blogg/" > /dev/null
  grep -q 'rel="canonical"' "$TMP" || { off=1; break; }
  echo "  retry $i: workers.dev still serves the site"
  sleep 15
done
if [ -n "$off" ]; then echo "OK   workers.dev off"; else echo "FAIL workers.dev still serves the site"; FAIL=1; fi
# MTA-STS (RFC 8461): senders take the policy only from its own host, only as
# a 200 with no redirect — the Worker proxies Cloudflare's (routes/mta-sts.ts).
# A custom domain's certificate can take minutes on its first deploy: wait up
# to 5 min for the host to answer before check()'s own retries.
for i in $(seq 1 20); do
  curl -sSf -o /dev/null --max-time 10 "https://mta-sts.rozsoshnykh.no/.well-known/mta-sts.txt" 2>/dev/null && break
  echo "  waiting for mta-sts.rozsoshnykh.no ($i/20)"
  sleep 15
done
check "mta-sts policy" "https://mta-sts.rozsoshnykh.no/.well-known/mta-sts.txt" 200 '^version: STSv1' '^mx: '
check_header "mta-sts type" "https://mta-sts.rozsoshnykh.no/.well-known/mta-sts.txt" "^content-type: text/plain"

echo "== Security headers =="
check_header "HSTS"       "$BASE/" "^strict-transport-security:"
check_header "XFO"        "$BASE/" "^x-frame-options: DENY"
check_header "CSP header" "$BASE/" "^content-security-policy: frame-ancestors 'none'"
check_header "COOP"       "$BASE/" "^cross-origin-opener-policy: same-origin"
check_header "CSP report" "$BASE/" "^reporting-endpoints: csp-endpoint="
# Each page's own hash policy (a <meta> baked in at build) must cover every
# inline script it ships — else the page renders but none of it runs. Retried:
# right after a deploy some edges still serve the previous version.
for i in 1 2 3 4 5 6; do
  if node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-csp.mjs --live "$BASE" \
      / /en/ /blogg/velkommen/ /en/blog/welcome/ /kontakt/; then
    echo "OK   CSP (hash) on 5 pages"; break
  fi
  [ "$i" = 6 ] && { echo "FAIL CSP (hash)"; FAIL=1; break; }
  echo "  retry $i: CSP (hash)"; sleep 15
done
check_no_edge_script "no edge script" "$BASE/"
# The "Block scanners" WAF rule (.github/waf/scanner-block.expr) keeps its
# word patterns off blog paths, so a slug naming a scanner target reaches the
# site's 404 (X-Frame-Options DENY, public/_headers) instead of Cloudflare's
# 403 (SAMEORIGIN). Catches a dashboard edit that brings path-anywhere
# `contains` patterns back. A synthetic slug, and only the header asserted,
# so a real post by that name can't turn this red.
check_header "WAF slug-safe" "$BASE/blogg/wp-jenkins-canary/" "^x-frame-options: DENY"

echo "== Caching =="
# Static files skip the Worker (run_worker_first in wrangler.jsonc) and take
# their browser cache from public/_headers, so repeat visits and client-side
# navigations don't re-download every chunk. world.svg is the canary: its
# cache header proves _headers applied, and no X-Frame-Options (which the
# Worker sets on everything it serves, _headers only on page paths) proves
# no Worker request was spent.
check_header    "cache world.svg"    "$BASE/world.svg" "^cache-control: public, max-age=604800"
check_no_header "world.svg no Worker" "$BASE/world.svg" "^x-frame-options:"
# _headers stamps a static MISS with the same year-long immutable; the zone
# rule from .github/workflows/zone-rules.yml makes every 4xx/5xx no-store.
# Both directions: a miss (fresh URL per run) must be no-store, and a real
# chunk must keep its immutable — a rule widened to 200s would strip it.
MISS="$BASE/_next/static/chunks/smoke-miss-$$.js"
check        "static miss"          "$MISS" 404
check_header "static miss no-store" "$MISS" "^cache-control: no-store"
CHUNK=$(curl -sS --max-time 20 -A "$UA" "$BASE/" | grep -o '/_next/static/chunks/[^"]*\.js' | head -1)
check_header "chunk immutable" "$BASE$CHUNK" "^cache-control: public, max-age=31536000, immutable"

if [ "$FAIL" = "1" ]; then
  echo; echo "Smoke test FAILED"
  exit 1
fi
echo; echo "Smoke test passed"
