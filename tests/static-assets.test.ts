import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Static files skip the Worker (negative run_worker_first patterns in
// wrangler.jsonc) and take their headers from public/_headers instead — which
// never applies to a Worker response. The two lists must match: a path only
// in _headers would silently lose its cache headers to the Worker, a path
// only in wrangler.jsonc would be served with the asset server's
// must-revalidate default.

function headerRules(): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>()
  let current: Map<string, string> | null = null
  for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      current = new Map()
      rules.set(line.trim(), current)
    } else if (current) {
      const i = line.indexOf(':')
      current.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim())
    }
  }
  return rules
}

function runWorkerFirst(): string[] {
  const m = readFileSync('wrangler.jsonc', 'utf8').match(/"run_worker_first":\s*(\[[^\]]*\])/)
  if (!m) throw new Error('run_worker_first array not found in wrangler.jsonc')
  return JSON.parse(m[1])
}

describe('static assets served without the Worker', () => {
  it('runs the Worker first for everything else', () => {
    expect(runWorkerFirst()[0]).toBe('/*')
  })

  it('gives every Worker-skipping path a _headers rule, and nothing more', () => {
    const skipped = runWorkerFirst()
      .filter((p) => p.startsWith('!'))
      .map((p) => p.slice(1))
    expect([...headerRules().keys()].sort()).toEqual(skipped.sort())
  })

  it('caches build output immutably and stable URLs for a week, all nosniff', () => {
    for (const [path, headers] of headerRules()) {
      expect(headers.get('cache-control')).toBe(
        path === '/_next/static/*' ? 'public, max-age=31536000, immutable' : 'public, max-age=604800',
      )
      expect(headers.get('x-content-type-options')).toBe('nosniff')
    }
  })
})
