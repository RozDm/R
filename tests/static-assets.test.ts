import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BASE_SECURITY_HEADERS, CSP_REPORT_GROUP, CSP_REPORT_PATH, HEADER_CSP, HSTS } from '@/src/csp'
import { SITE_URL } from '@/lib/site'
import { CONTACT_ADDRESS } from '@/src/contact'

// Pages and files are served by the asset server, not the Worker
// (run_worker_first: /api/* and the MTA-STS policy), and take every header
// from public/_headers — which never applies to a Worker response. So _headers must carry what the
// Worker would have set, and the two copies must not drift.

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

// Top-level app/ folders that render pages (a page.tsx of their own).
function pageDirs(): string[] {
  return readdirSync('app', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join('app', d.name, 'page.tsx')))
    .map((d) => d.name)
}

const rules = headerRules()
const PAGE_RULES = ['/', ...pageDirs().map((d) => `/${d}/*`)]

describe('asset server headers (public/_headers)', () => {
  it('runs the Worker first for /api/* and the MTA-STS policy only', () => {
    expect(runWorkerFirst()).toEqual(['/api/*', '/.well-known/mta-sts.txt'])
  })

  it('stamps the Worker’s security headers on every response', () => {
    const want: Record<string, string> = {
      'strict-transport-security': HSTS,
      'content-security-policy': HEADER_CSP,
      'reporting-endpoints': `${CSP_REPORT_GROUP}="${SITE_URL}${CSP_REPORT_PATH}"`,
    }
    for (const [k, v] of Object.entries(BASE_SECURITY_HEADERS)) {
      if (k !== 'X-Frame-Options') want[k.toLowerCase()] = v
    }
    expect(Object.fromEntries(rules.get('/*') ?? [])).toEqual(want)
  })

  it('keeps fetch directives out of the header CSP, so it cannot veto a page’s hashes', () => {
    for (const d of HEADER_CSP.split('; ')) {
      expect(d).toMatch(/^(frame-ancestors|object-src|base-uri|form-action) /)
    }
  })

  it('sets X-Frame-Options DENY on every page path, and not on world.svg', () => {
    expect(PAGE_RULES).toEqual(expect.arrayContaining(['/', '/blogg/*', '/en/*', '/kontakt/*', '/personvern/*']))
    for (const path of PAGE_RULES) {
      expect(rules.get(path)?.get('x-frame-options'), path).toBe(BASE_SECURITY_HEADERS['X-Frame-Options'])
    }
    for (const [path, headers] of rules) {
      if (!PAGE_RULES.includes(path)) expect(headers.has('x-frame-options'), path).toBe(false)
    }
  })

  it('sets each header in one rule only — overlapping rules would join two values with a comma', () => {
    const global = rules.get('/*') ?? new Map()
    for (const [path, headers] of rules) {
      if (path === '/*') continue
      for (const name of headers.keys()) expect(global.has(name), `${path} ${name}`).toBe(false)
    }
  })

  it('caches build output immutably and stable URLs for a week', () => {
    expect(rules.get('/_next/static/*')?.get('cache-control')).toBe('public, max-age=31536000, immutable')
    for (const path of ['/world.svg', '/fonts/*', '/icons/*', '/favicon.ico']) {
      expect(rules.get(path)?.get('cache-control'), path).toBe('public, max-age=604800')
    }
  })

  it('types the extension-less OG cards as PNG', () => {
    for (const path of [
      '/opengraph-image',
      '/en/opengraph-image',
      '/blogg/:slug/opengraph-image',
      '/en/blog/:slug/opengraph-image',
    ]) {
      expect(rules.get(path)?.get('content-type'), path).toBe('image/png')
    }
  })
})

// RFC 9116: a security.txt past its Expires is to be treated as stale, and
// one more than a year out is discouraged. Fails 30 days ahead, so the yearly
// bump happens in time (CLAUDE.md, Architecture).
describe('/.well-known/security.txt', () => {
  const lines = readFileSync('public/.well-known/security.txt', 'utf8')
    .split('\n')
    .map((line) => line.match(/^([\w-]+):\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
  const fields = new Map(lines.map((m) => [m[1], m[2].trim()]))
  const all = (name: string) => lines.filter((m) => m[1] === name).map((m) => m[2].trim())

  it('names the site address first, the private advisory form and the policy', () => {
    expect(all('Contact')).toEqual([
      `mailto:${CONTACT_ADDRESS}`,
      'https://github.com/RozDm/R/security/advisories/new',
    ])
    expect(fields.get('Canonical')).toBe(`${SITE_URL}/.well-known/security.txt`)
    expect(fields.get('Policy')).toBe('https://github.com/RozDm/R/security/policy')
  })

  it('expires more than 30 days and at most a year from now', () => {
    const left = Date.parse(fields.get('Expires') ?? '') - Date.now()
    expect(left, 'Expires — bump it (≤ a year ahead)').toBeGreaterThan(30 * 86_400_000)
    expect(left).toBeLessThanOrEqual(366 * 86_400_000)
  })
})
