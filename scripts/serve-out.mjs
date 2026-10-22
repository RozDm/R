// Serves out/ for the browser tests (playwright.config.ts, e2e/) the way the
// asset server does in production, minus public/_headers: a page at its
// trailing-slash path, a 301 from the slash-less one, and the 404 page (with a
// 404) for a miss. /api/* belongs to the Worker — the tests stub it with
// page.route, so here it is a plain miss. Zero dependencies; test-only.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'

const ROOT = resolve('out')
const PORT = Number(process.env.PORT ?? 4173)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const isFile = (p) => existsSync(p) && statSync(p).isFile()

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let path
  try {
    path = decodeURIComponent(url.pathname)
  } catch {
    return send(res, 404, join(ROOT, '404.html'))
  }
  const file = resolve(ROOT, `.${path}`)
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return send(res, 404, join(ROOT, '404.html'))

  if (path.endsWith('/') && isFile(join(file, 'index.html'))) return send(res, 200, join(file, 'index.html'))
  if (!path.endsWith('/') && isFile(file)) return send(res, 200, file)
  if (!path.endsWith('/') && isFile(join(file, 'index.html'))) {
    res.writeHead(301, { Location: `${url.pathname}/${url.search}` })
    return res.end()
  }
  return send(res, 404, join(ROOT, '404.html'))
}).listen(PORT, () => console.log(`serve-out: out/ on http://localhost:${PORT}`))
