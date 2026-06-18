#!/usr/bin/env bash
# SessionStart hook: make sure node_modules matches package-lock.json so
# lint/typecheck/test/build work the moment the session opens. Only runs in
# the remote (Claude Code on the web) container, where the repo is cloned
# fresh; locally the environment is presumably already set up.
#
# Idempotent: `npm ci` only runs when node_modules is missing or the hash of
# package-lock.json has changed since the last successful install (tracked in
# a sentinel). Nothing here reaches outside npm, so the egress allowlist
# applies to the registry only.
set -euo pipefail

# Only act in the managed remote container.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ ! -f package-lock.json ]; then
  echo "session-start: no package-lock.json, skipping install"
  exit 0
fi

SENTINEL="node_modules/.session-start-lock"
lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"

if [ -d node_modules ] && [ -f "$SENTINEL" ] && [ "$(cat "$SENTINEL")" = "$lock_hash" ]; then
  echo "session-start: node_modules in sync with package-lock.json, skipping"
  exit 0
fi

echo "session-start: installing dependencies via npm ci"
npm ci --no-audit --no-fund
echo "$lock_hash" > "$SENTINEL"
