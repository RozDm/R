// Generates src/csp-hashes.json: the sha256 (base64) of every inline <script>
// across all exported HTML pages, for the Worker's strict Content-Security-Policy.
//
// Run after `next build`:  node scripts/gen-csp-hashes.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

function htmlFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...htmlFiles(path))
    else if (entry.endsWith('.html')) out.push(path)
  }
  return out
}

const INLINE_SCRIPT = /<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi
const hashes = new Set()

for (const file of htmlFiles('out')) {
  const html = readFileSync(file, 'utf8')
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const digest = createHash('sha256').update(match[1], 'utf8').digest('base64')
    hashes.add(`'sha256-${digest}'`)
  }
}

const sorted = [...hashes].sort()
writeFileSync('src/csp-hashes.json', JSON.stringify(sorted, null, 2) + '\n')
console.log(`Wrote ${sorted.length} inline-script hashes to src/csp-hashes.json`)
