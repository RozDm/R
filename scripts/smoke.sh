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
  # The edge injects only into responses to an `Accept: text/html` request
  # (fetch() sends */*), so ask like a browser. Web Analytics' automatic
  # setup adds a <script data-cf-beacon>, JavaScript Detections a
  # /cdn-cgi/challenge-platform/ loader: the hash CSP refuses both, each
  # refusal is a CSP report (one Worker request per page view), and the
  # injection strips the HTML's ETag. Off in the dashboard is the only fix.
  local name=$1 url=$2 code i
  for i in 1 2 3; do
    code=$(curl -sS -o "$TMP" -w '%{http_code}' --max-time 20 -A "$UA" -H 'Accept: text/html' "$url" 2>/dev/null)
    [ "$code" = "200" ] && break
    echo "  retry $i: $url -> ${code:-ERR}, want 200"
    sleep 15
  done
  if [ "$code" != "200" ]; then
    echo "FAIL $name: $url -> $code (want 200)"
    FAIL=1
  elif grep -qE 'data-cf-beacon|/cdn-cgi/challenge-platform/' "$TMP"; then
    echo "FAIL $name: $url carries an edge-injected script (Web Analytics beacon or JSD loader)"
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
# English twins (/en/): the Worker must rewrite <html lang> for them.
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
check "robots.txt"  "$BASE/robots.txt"       200 "Sitemap: $BASE/sitemap.xml" "Disallow: /api/"
check "sitemap"     "$BASE/sitemap.xml"      200 "<loc>$BASE/blogg/"
check "rss"         "$BASE/feed.xml"         200 "<rss"
check "og-image"    "$BASE/opengraph-image"  200
check "world-svg"   "$BASE/world.svg"        200 "<svg"
check "security.txt" "$BASE/.well-known/security.txt" 200 "Contact: mailto:"
check "icon-512"    "$BASE/icons/icon-512.png" 200
check "favicon.ico" "$BASE/favicon.ico"      200

echo "== Canonical host =="
check_redirect "www"         "https://www.rozsoshnykh.no/"        "$BASE/"
check_redirect "workers.dev" "https://d.rozsoshnykh.workers.dev/" "$BASE/"
check_redirect "no-slash"    "$BASE/blogg"                         "$BASE/blogg/"

echo "== Security headers =="
check_header "HSTS"       "$BASE/" "^strict-transport-security:"
check_header "CSP (hash)" "$BASE/" "^content-security-policy:.*sha256-"
check_header "COOP"       "$BASE/" "^cross-origin-opener-policy: same-origin"
check_header "CSP report" "$BASE/" "^reporting-endpoints: csp-endpoint="
check_no_edge_script "no edge script" "$BASE/"
# The "Block scanners" WAF rule (.github/waf/scanner-block.expr) keeps its
# word patterns off blog paths, so a slug naming a scanner target reaches the
# Worker (its 404 says X-Frame-Options DENY) instead of Cloudflare's 403
# (SAMEORIGIN). Catches a dashboard edit that brings path-anywhere
# `contains` patterns back. A synthetic slug, and only the header asserted,
# so a real post by that name can't turn this red.
check_header "WAF slug-safe" "$BASE/blogg/wp-jenkins-canary/" "^x-frame-options: DENY"

echo "== Caching =="
# Static files skip the Worker (run_worker_first in wrangler.jsonc) and take
# their browser cache from public/_headers, so repeat visits and client-side
# navigations don't re-download every chunk. world.svg is the canary: its
# cache header proves _headers applied, and no X-Frame-Options (which the
# Worker sets on everything it serves) proves no Worker request was spent.
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
