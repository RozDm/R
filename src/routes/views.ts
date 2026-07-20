// /api/views/<slug> — GET reads the counter, POST counts one view. Only the
// page's own same-origin fetch() counts, so crawlers and external spam can't
// inflate it.
import { apiJson } from '../http'
import { isValidSlug, isWriteAllowed } from '../metrics'

// The header gates are spoofable (any client can send Sec-Fetch-Site and a
// browser UA), so a POST must also prove the slug is a real published post
// before it may mint a D1 row — otherwise junk slugs accumulate in `views`
// forever. The static export is the source of truth: the post page exists
// iff the slug is live (drafts never reach the export). Checked via the
// ASSETS binding — a Worker can't fetch its own public URL.
async function isPublishedPost(url: URL, env: Env, slug: string): Promise<boolean> {
  const page = await env.ASSETS.fetch(new Request(`${url.origin}/blogg/${slug}/`))
  await page.body?.cancel()
  return page.status === 200
}

export async function handleViews(url: URL, request: Request, env: Env): Promise<Response | null> {
  const match = url.pathname.match(/^\/api\/views\/([^/]+)$/)
  if (!match) return null

  const slug = match[1]
  if (!isValidSlug(slug)) return apiJson('{"error":"bad slug"}', 400)

  if (
    request.method === 'POST' &&
    isWriteAllowed(request.headers) &&
    (await isPublishedPost(url, env, slug))
  ) {
    const row = await env.METRICS.prepare(
      'INSERT INTO views (slug, count) VALUES (?1, 1) ON CONFLICT(slug) DO UPDATE SET count = count + 1 RETURNING count',
    )
      .bind(slug)
      .first<{ count: number }>()
      .catch(() => null)
    if (row) {
      // Append a time-series point alongside the D1 increment. Sampled,
      // append-only, so it doesn't fight the D1 counter — D1 stays the
      // truth for totals, AE answers "when".
      try {
        env.METRICS_AE.writeDataPoint({ indexes: [slug], blobs: ['view', slug], doubles: [1] })
      } catch {}
      return apiJson(JSON.stringify({ views: row.count }))
    }
  }

  const row = await env.METRICS.prepare('SELECT count FROM views WHERE slug = ?1')
    .bind(slug)
    .first<{ count: number }>()
    .catch(() => null)
  return apiJson(JSON.stringify({ views: row?.count ?? 0 }))
}
