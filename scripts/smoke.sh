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
check "home"        "$BASE/"                 200 "Dmytro Rozsoshnykh" "Driftsstatus" 'name="robots" content="noindex'
check "blogg"       "$BASE/blogg/"           200 "Artikler"
check "post"        "$BASE/blogg/velkommen/" 200 "Velkommen"
check "tag"         "$BASE/blogg/tag/velkommen/" 200 "Velkommen"
check "kontakt"     "$BASE/kontakt/"         200 "Kontaktskjema"
check "404"         "$BASE/finnes-ikke/"     404

echo "== Machine endpoints =="
check "api/status"  "$BASE/api/status"       200 '"results"'
check "api/views"   "$BASE/api/views/velkommen" 200 '"views"'
check "api/geo"     "$BASE/api/geo"          200 '"countries"'
check "api/ts/geo"  "$BASE/api/timeseries?metric=geo&range=7d" 200 '"points"'
check "api/ts/all"  "$BASE/api/timeseries?metric=geo&range=all" 200 '"points"'
check "api/ts/view" "$BASE/api/timeseries?metric=view&range=7d" 200 '"points"'
check "robots.txt"  "$BASE/robots.txt"       200 "Sitemap: $BASE/sitemap.xml"
check "sitemap"     "$BASE/sitemap.xml"      200 "<loc>$BASE/blogg/"
check "rss"         "$BASE/feed.xml"         200 "<rss"
check "og-image"    "$BASE/opengraph-image"  200
check "world-svg"   "$BASE/world.svg"        200 "<svg"

echo "== Canonical host =="
check_redirect "www"         "https://www.rozsoshnykh.no/"        "$BASE/"
check_redirect "workers.dev" "https://d.rozsoshnykh.workers.dev/" "$BASE/"

echo "== Security headers =="
check_header "HSTS"       "$BASE/" "^strict-transport-security:"
check_header "CSP (hash)" "$BASE/" "^content-security-policy:.*sha256-"
check_header "COOP"       "$BASE/" "^cross-origin-opener-policy: same-origin"

echo "== Caching =="
# Static assets must carry a real browser cache so repeat visits and
# client-side navigations don't re-download every chunk. world.svg is the
# stable-URL canary for the whole cacheControlFor() rule.
check_header "cache world.svg" "$BASE/world.svg" "^cache-control: public, max-age=604800"

if [ "$FAIL" = "1" ]; then
  echo; echo "Smoke test FAILED"
  exit 1
fi
echo; echo "Smoke test passed"
