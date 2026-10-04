// In-process fakes for the Worker's bindings, so route handlers run under
// plain Vitest (no workerd). D1 is REAL SQLite (node:sqlite) loaded with
// schema/metrics.sql — SQL semantics such as TEXT comparison are exactly
// what production gets, which is what caught the ISO-vs-datetime() bug.
import { DatabaseSync } from 'node:sqlite'
import schema from '../../schema/metrics.sql?raw'

export interface FakeEnv {
  env: Env
  db: DatabaseSync
  aePoints: { indexes?: string[]; blobs?: unknown[]; doubles?: number[] }[]
  sent: { from: string; to: string; raw: string }[]
  failMail: (fail: boolean) => void
  publishedSlugs: Set<string>
}

export function makeEnv(overrides: Partial<Record<string, unknown>> = {}): FakeEnv {
  const db = new DatabaseSync(':memory:')
  db.exec(schema)

  const d1 = {
    prepare(sql: string) {
      let params: unknown[] = []
      const stmt = {
        bind(...p: unknown[]) {
          params = p
          return stmt
        },
        async first<T>() {
          return (db.prepare(sql).get(...params) ?? null) as T | null
        },
        async run() {
          db.prepare(sql).run(...params)
          return { success: true }
        },
        async all<T>() {
          return { results: db.prepare(sql).all(...params) as T[] }
        },
      }
      return stmt
    },
  }

  const aePoints: FakeEnv['aePoints'] = []
  const sent: FakeEnv['sent'] = []
  let mailFails = false
  const publishedSlugs = new Set<string>(['velkommen'])

  const env = {
    METRICS: d1,
    METRICS_AE: { writeDataPoint: (p: FakeEnv['aePoints'][number]) => void aePoints.push(p) },
    CONTACT_EMAIL: {
      send: async (m: { from: string; to: string; raw: string }) => {
        if (mailFails) throw new Error('Email Routing unavailable')
        sent.push(m)
      },
    },
    ASSETS: {
      fetch: async (req: Request) => {
        const slug = /^\/blogg\/([^/]+)\/$/.exec(new URL(req.url).pathname)?.[1]
        return new Response('<html></html>', { status: slug && publishedSlugs.has(slug) ? 200 : 404 })
      },
    },
    ...overrides,
  } as unknown as Env

  return { env, db, aePoints, sent, failMail: (f) => (mailFails = f), publishedSlugs }
}

// waitUntil promises are collected so a test can await the background writes.
export function makeCtx(): { ctx: ExecutionContext; settle: () => Promise<void> } {
  const pending: Promise<unknown>[] = []
  const ctx = {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext
  return { ctx, settle: async () => void (await Promise.all(pending)) }
}

export const BROWSER_HEADERS = {
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
  'cf-connecting-ip': '203.0.113.7',
}
