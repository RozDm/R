#!/usr/bin/env node
// PreToolUse(Bash) hook: the generated files are denied to Read (settings.json)
// because each one is tens to hundreds of KB of tokens — this closes the shell
// route around that (cat/head/grep/sed/… or `git show rev:file`). `git diff
// --stat`, `wc`, `ls` and npm/npx on them are fine. Fails open.
import fs from 'node:fs'

const GUARDED = /(^|[\s/'"=:])(worker-configuration\.d\.ts|package-lock\.json|world\.svg)\b/
const READERS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'sed', 'awk', 'grep', 'egrep', 'fgrep', 'rg',
  'jq', 'nl', 'cut', 'sort', 'uniq', 'xxd', 'od', 'strings', 'bat', 'python', 'python3',
])

try {
  const { tool_input: { command = '' } = {} } = JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
  const hit = command.split(/&&|\|\||[;|\n]/).some((segment) => {
    if (!GUARDED.test(segment)) return false
    const words = segment.trim().split(/\s+/).filter((w) => !/^\w+=/.test(w))
    const [cmd, sub] = words
    return READERS.has(cmd?.split('/').pop()) || (cmd === 'git' && sub === 'show')
  })
  if (hit) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'worker-configuration.d.ts, package-lock.json and public/world.svg are generated and huge. ' +
            'Regenerate them (npm run cf-typegen / npm install / npm run build) and check with ' +
            '`git diff --stat`; read the source instead (wrangler.jsonc, package.json, scripts/build-world-svg.mjs).',
        },
      }),
    )
  }
} catch {
  // fail open
}
