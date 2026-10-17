// CI guard for the "Block scanners" WAF rule: .github/waf/scanner-block.expr,
// applied by .github/workflows/zone-rules.yml. Cloudflare 403s a match before
// the Worker sees it, so a pattern that hits a page, its RSC payload or its
// /api/views counter takes that URL down without a trace in our logs. This
// evaluates the expression as the workflow sends it, with a model of the
// Rules-language subset it uses (developers.cloudflare.com/ruleset-engine/
// rules-language/{operators,functions}), and fails when it blocks any URL the
// build serves, lets through a scanner path it exists to block, or breaks a
// Free limit. Every URL is tried under each URL-normalization model and each
// reading of `.extension` the docs leave open (docs/cloudflare-security.md).
// Runs after `npm run build` (CI and deploy); `--self-test` checks only the
// evaluator, which also runs first on every check.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPR_FILE = '.github/waf/scanner-block.expr'
const PATH = 'http.request.uri.path'
const EXT = 'http.request.uri.path.extension'
const MAX_CHARS = 4096 // expression size, every plan
const MAX_WILDCARDS = 64 // the per-rule regex cap; whether wildcards count is undocumented
const MODELS = ['rfc', 'cf', 'rfc+bs']
const READINGS = ['A', 'B', 'C']

// --- Rules language: tokens, parser (not > and > xor > or), evaluator -----
const SYMBOLS = { '&&': 'and', '||': 'or', '^^': 'xor', '==': 'eq', '!=': 'ne', '!': 'not' }
const WORDS = new Set(['not', 'and', 'xor', 'or', 'eq', 'ne', 'contains', 'wildcard', 'strict', 'matches', 'in'])

function tokenize(src) {
  const toks = []
  for (const m of src.matchAll(/\s+|([(){},])|"((?:[^"\\]|\\.)*)"|(&&|\|\||\^\^|==|!=|!)|([A-Za-z_][\w.]*)|(.)/gs)) {
    const [, punct, str, sym, word, bad] = m
    if (bad !== undefined) throw new Error(`unexpected ${JSON.stringify(bad)} at offset ${m.index}`)
    if (punct) toks.push({ k: punct })
    else if (sym) toks.push({ k: 'kw', v: SYMBOLS[sym] })
    else if (str !== undefined) {
      const v = str.replace(/\\(.)/g, (_, c) => {
        if (c !== '"' && c !== '\\') throw new Error(`invalid escape \\${c} in "${str}"`)
        return c
      })
      toks.push({ k: 'str', v })
    } else if (word) {
      if (!WORDS.has(word) && WORDS.has(word.toLowerCase())) throw new Error(`operators are lowercase: ${word}`)
      toks.push({ k: WORDS.has(word) ? 'kw' : 'id', v: word })
    }
  }
  return toks
}

// Only what the rule needs: the path and its extension, lower(),
// starts_with()/ends_with(), eq/ne/contains/[strict] wildcard/in {…}.
function parse(src) {
  const t = tokenize(src)
  let i = 0
  let wildcards = 0
  const at = (k, v) => t[i]?.k === k && (v === undefined || t[i].v === v)
  const need = (k) => {
    if (!at(k)) throw new Error(`expected ${k} at token ${i}, got ${JSON.stringify(t[i]?.v ?? t[i]?.k ?? 'end')}`)
    return t[i++]
  }
  const binary = (op, next) => () => {
    let l = next()
    while (at('kw', op)) {
      i++
      l = { op, l, r: next() }
    }
    return l
  }
  const unary = () => {
    if (!at('kw', 'not')) return primary()
    i++
    return { op: 'not', x: unary() }
  }
  const or = binary('or', binary('xor', binary('and', unary)))
  function value() {
    const id = need('id').v
    if (!at('(')) {
      if (id !== PATH && id !== EXT) throw new Error(`unsupported field ${id}`)
      return { field: id }
    }
    if (!['lower', 'starts_with', 'ends_with'].includes(id)) throw new Error(`unsupported function ${id}`)
    i++
    const fn = { fn: id, arg: value() }
    if (id !== 'lower') {
      need(',')
      fn.lit = need('str').v // starts_with/ends_with: a boolean test of a literal
    }
    need(')')
    return fn
  }
  function primary() {
    if (at('(')) {
      i++
      const e = or()
      need(')')
      return e
    }
    const lhs = value()
    if (lhs.lit !== undefined) return lhs
    let cmp = need('kw').v
    if (cmp === 'strict') cmp = need('kw').v === 'wildcard' ? 'swildcard' : 'strict'
    if (cmp === 'matches') throw new Error('matches (regex) needs Business or higher')
    if (cmp === 'in') {
      need('{')
      const set = []
      while (!at('}')) set.push(need('str').v)
      i++
      return { cmp, lhs, set }
    }
    if (!['eq', 'ne', 'contains', 'wildcard', 'swildcard'].includes(cmp)) throw new Error(`unsupported operator ${cmp}`)
    const rhs = need('str').v
    if (!cmp.endsWith('wildcard')) return { cmp, lhs, rhs }
    wildcards++
    return { cmp, lhs, rhs, re: wildcardRe(rhs, cmp === 'swildcard') }
  }
  const ast = or()
  if (i !== t.length) throw new Error(`unexpected ${JSON.stringify(t[i].v ?? t[i].k)} at token ${i}`)
  return { ast, wildcards, strings: t.filter((x) => x.k === 'str').map((x) => x.v) }
}

// wildcard: the whole value, `*` = any run of characters including `/`,
// `\*` and `\\` literal, `**` invalid; case-insensitive unless strict.
function wildcardRe(pat, strict = false) {
  let re = ''
  for (let j = 0; j < pat.length; j++) {
    const c = pat[j]
    if (c === '*') {
      if (pat[j + 1] === '*') throw new Error(`"**" is invalid in wildcard "${pat}"`)
      re += '[^]*'
    } else if (c === '\\') {
      const n = pat[++j]
      if (n !== '*' && n !== '\\') throw new Error(`invalid escape in wildcard "${pat}"`)
      re += `\\${n}`
    } else re += c.replace(/[.+?^${}()|[\]]/, '\\$&')
  }
  return new RegExp(`^${re}$`, strict ? '' : 'i')
}

function evaluate(n, ctx) {
  if (n.op === 'or') return evaluate(n.l, ctx) || evaluate(n.r, ctx)
  if (n.op === 'and') return evaluate(n.l, ctx) && evaluate(n.r, ctx)
  if (n.op === 'xor') return evaluate(n.l, ctx) !== evaluate(n.r, ctx)
  if (n.op === 'not') return !evaluate(n.x, ctx)
  if (n.fn) return n.fn === 'starts_with' ? val(n.arg, ctx).startsWith(n.lit) : val(n.arg, ctx).endsWith(n.lit)
  const v = val(n.lhs, ctx)
  if (n.cmp === 'eq') return v === n.rhs
  if (n.cmp === 'ne') return v !== n.rhs
  if (n.cmp === 'contains') return v.includes(n.rhs)
  if (n.cmp === 'in') return n.set.includes(v)
  return n.re.test(v)
}
const val = (n, ctx) => (n.field ? ctx[n.field] : val(n.arg, ctx).toLowerCase())

// The leaf tests that fired, to say why a URL is blocked.
function why(n, ctx) {
  if (n.op) return [n.l, n.r, n.x].flatMap((c) => (c ? why(c, ctx) : []))
  if (n.fn || !evaluate(n, ctx)) return []
  return [n.cmp === 'in' ? `extension "${ctx[EXT]}"` : `${n.cmp} "${n.rhs}"`]
}

// --- What the WAF sees ---------------------------------------------------------
// URL normalization (rules/normalization): 'rfc' = RFC 3986 — decode %XX of
// unreserved characters, upper-case the rest, encode bytes outside the URI
// set, remove dot segments; 'cf' = Cloudflare's type, which first turns `\`
// into `/` and merges `//`; 'rfc+bs' = what was measured live (a literal `\`
// acts as `/`, `//` is kept). The zone's actual type is unconfirmed.
function normalize(raw, model) {
  let s = model === 'rfc' ? raw : raw.replaceAll('\\', '/')
  if (model === 'cf') s = s.replace(/\/{2,}/g, '/')
  s = s.replace(/%([0-9A-Fa-f]{2})|[^\w\-.~:/?#[\]@!$&'()*+,;=%]/gu, (m, hex) => {
    if (!hex) return encodeURI(m)
    const c = String.fromCharCode(parseInt(hex, 16))
    return /[\w\-.~]/.test(c) ? c : m.toUpperCase()
  })
  // Dot segments (RFC 3986 5.2.4): `.` goes, `..` takes its parent along,
  // and either one last leaves a trailing slash.
  const segs = s.split('/').slice(1)
  const out = []
  for (const [j, seg] of segs.entries()) {
    if (seg !== '.' && seg !== '..') out.push(seg)
    else {
      if (seg === '..') out.pop()
      if (j === segs.length - 1) out.push('')
    }
  }
  return `/${out.join('/')}`
}

// `.extension`: lowercased text after the last dot of the last segment; ""
// without a dot, for a trailing dot and for a dot-first segment with no other
// dot. A trailing slash is undocumented: A = it ends the segment ("/a.sh/" →
// ""), B = literally after the last dot in the path ("sh/"), C = ignored ("sh").
function extension(p, reading) {
  if (reading === 'C') p = p.replace(/\/+$/, '')
  const seg = p.slice(p.lastIndexOf('/') + 1)
  if (/^\.[^.]*$/.test(seg)) return ''
  const from = reading === 'B' ? p : seg
  const dot = from.lastIndexOf('.')
  return dot < 0 ? '' : from.slice(dot + 1).toLowerCase()
}

// → [{ combo: 'rfc/A', why }] for each model × reading under which `raw` is blocked.
function blockedUnder(ast, raw) {
  const hits = []
  for (const m of MODELS) {
    const p = normalize(raw, m)
    for (const r of READINGS) {
      const ctx = { [PATH]: p, [EXT]: extension(p, r) }
      if (evaluate(ast, ctx)) hits.push({ combo: `${m}/${r}`, why: why(ast, ctx) })
    }
  }
  return hits
}

// --- Self-test: the docs' own examples, so a broken evaluator can't pass ----
function selfTest() {
  const bad = []
  const eq = (got, want, what) =>
    got === want || bad.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  // The extension field's table (fields/reference), then the trailing slash.
  const ext = {
    '/foo': '', '/foo.mp3': 'mp3', '/.mp3': '', '/.foo.mp3': 'mp3', '/foo.tar.bz2': 'bz2', '/foo.': '', '/foo.MP3': 'mp3',
  }
  for (const [p, want] of Object.entries({ ...ext, '/articles/index.html': 'html', '/articles/index.': '' })) {
    for (const r of READINGS) eq(extension(p, r), want, `extension ${r} ${p}`)
  }
  for (const [r, want] of [['A', ''], ['B', 'sh/'], ['C', 'sh']]) {
    eq(extension('/a.sh/', r), want, `extension ${r} /a.sh/`)
  }
  // The operators page's wildcard examples A and B: [matches, non-matches].
  const wc = {
    'http*://example.com/a/*': [
      'https://example.com/a/ http://example.com/a/ https://example.com/a/page.html ' +
        'https://example.com/a/sub/folder/?name=value',
      'https://example.com/ab/ https://example.com/b/page.html https://sub.example.com/a/',
    ],
    '*.example.com/*/page.html': [
      'http://sub.example.com/folder/page.html https://admin.example.com/team/page.html ' +
        'https://admin.example.com/team/subteam/page.html',
      'https://example.com/ab/page.html https://sub.example.com/folder2/page.html?s=value https://sub.example.com/a/',
    ],
  }
  for (const [pat, [yes, no]] of Object.entries(wc)) {
    for (const u of yes.split(' ')) eq(wildcardRe(pat).test(u), true, `wildcard "${pat}" ${u}`)
    for (const u of no.split(' ')) eq(wildcardRe(pat).test(u), false, `wildcard "${pat}" ${u}`)
  }
  eq(wildcardRe('/ADMIN*').test('/admin/x'), true, 'wildcard is case-insensitive')
  eq(wildcardRe('/ADMIN*', true).test('/admin/x'), false, 'strict wildcard is case-sensitive')
  eq(wildcardRe('/a\\*').test('/a*') && !wildcardRe('/a\\*').test('/ab'), true, 'wildcard \\* is a literal star')
  const norm = [['/%77p-login.php', 'rfc', '/wp-login.php'], ['/a%2fb', 'rfc', '/a%2Fb'],
    ['/a/../b/./c', 'rfc', '/b/c'],
    ['/%2e%2e/etc', 'rfc', '/etc'], ['/a/..', 'rfc', '/'], ['//a', 'rfc', '//a'], ['//a\\b', 'cf', '/a/b'],
    ['/\\wp', 'rfc+bs', '//wp'], ['/\\wp', 'rfc', '/%5Cwp'], ['/blogg/ø/', 'rfc', '/blogg/%C3%B8/']]
  for (const [raw, model, want] of norm) eq(normalize(raw, model), want, `normalize ${model} ${raw}`)
  const run = (src, p) => evaluate(parse(src).ast, { [PATH]: p, [EXT]: extension(p, 'A') })
  const P = PATH
  eq(run(`${P} eq "/x" or ${P} eq "/y" and not ${P} contains "y"`, '/y'), false, 'not > and > or')
  eq(run(`${P} eq "/x" xor ${P} contains "x" and ${P} eq "/y"`, '/x'), true, 'and binds tighter than xor')
  eq(run(`${P} eq "/x" or ${P} eq "/x" xor ${P} contains "x"`, '/x'), true, 'xor binds tighter than or')
  eq(run(`not starts_with(${P}, "/blogg/") && ${EXT} in {"php" "sh"}`, '/a/B.PHP'), true, 'starts_with, in, extension')
  eq(run(`lower(${P}) contains "/wp-" and ends_with(${P}, "x")`, '/WP-x'), true, 'lower(), ends_with()')
  const invalid = [`${P} matches "^/a"`, `${P} CONTAINS "a"`, `${P} wildcard "/a**"`, 'http.host eq "a"',
    `(${P} eq "/a"`,
    `${P} eq "\\d"`, `${P} eq "/a" ${P}`, `${P} strict eq "/a"`]
  const throws = (src) => {
    try {
      parse(src)
    } catch {
      return true
    }
  }
  for (const src of invalid) eq(throws(src), true, `rejects ${src}`)
  return bad
}

// --- Corpora ---------------------------------------------------------------------
// Scanner paths the rule exists to stop (from the 313-path review corpus).
const MUST_BLOCK = `/wp-login.php /WP-LOGIN.PHP /wp-admin/ //wp-admin/ /xmlrpc.php /blog/wp-includes/wlwmanifest.xml
  /blogg/wp-includes/wlwmanifest.xml /blogg/xmlrpc.php /.env /.ENV /.git/config /en/blog/.git/config /.aws/credentials
  /.well-known/.env /phpmyadmin/ /PHPMYADMIN/ /adminer.php /vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php
  /index.php/api/index /actuator/env /cgi-bin/luci/;stok=/locale /owa/auth/logon.aspx /autodiscover/autodiscover.xml
  /secure/Dashboard.jspa /web.config /config.json /docker-compose.yml /Dockerfile /appsettings.json /backup.zip
  /db.sql /x.pyc /etc/passwd /server-status /HNAP1/ /_ignition/execute-solution /swagger.json`.split(/\s+/)

// Paths the Worker answers without a file in out/ (src/index.ts).
const WORKER_ROUTES = ['/api/status', '/api/geo', '/api/visit', '/api/timeseries', '/api/contact', '/api/csp-report',
  '/status', '/status/', '/favicon.ico', '/.well-known/security.txt']

function servedUrls() {
  const urls = new Set(WORKER_ROUTES)
  const outDir = path.join(ROOT, 'out')
  for (const e of fs.readdirSync(outDir, { recursive: true, withFileTypes: true })) {
    const u = `/${path.relative(outDir, path.join(e.parentPath, e.name)).split(path.sep).join('/')}`
    if (!e.isFile() || u === '/_headers') continue // _headers: the asset server's config, never served
    urls.add(u).add(u.replaceAll('$', '%24')) // the Worker 301s an RSC payload's `$` to %24
    if (u.endsWith('/index.html')) {
      const dir = u.slice(0, -'index.html'.length)
      urls.add(dir).add(dir.slice(0, -1) || '/')
    } else if (u.endsWith('.html')) urls.add(u.slice(0, -'.html'.length))
  }
  // /api/views/<viewKey> (lib/blog.ts): the Norwegian twin's slug, else the
  // post's own. Drafts too — they go public later.
  const slugs = (dir) =>
    fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3))
  const nb = slugs('content/blog')
  for (const slug of nb) urls.add(`/api/views/${slug}`)
  for (const slug of slugs('content/blog/en')) {
    const md = fs.readFileSync(path.join(ROOT, 'content/blog/en', `${slug}.md`), 'utf8')
    const twin = /^translationOf:\s*["']?([^"'\s]+)/m.exec(/^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] ?? '')?.[1]
    urls.add(`/api/views/${twin && nb.includes(twin) ? twin : slug}`)
  }
  // Future content: scanner words as slugs under every exempt prefix. The
  // exemptions are what keeps the word patterns off slugs, so dropping one
  // must fail here, not on the first post that happens to use such a word.
  for (const s of ['jenkins-pipeline', 'wp-cli', 'owasp-zap', 'backup-strategy', 'mysql-tuning', 'aws-console']) {
    for (const base of ['/blogg/', '/en/blog/', '/blogg/tag/', '/en/blog/tag/']) {
      urls.add(`${base}${s}/`).add(`${base}${s}`).add(`${base}${s}/index.txt`).add(`${base}${s}/opengraph-image`)
    }
    urls.add(`/api/views/${s}`).add(`/_next/static/chunks/${s}_0x.js`)
  }
  // Everything the post-deploy smoke test fetches.
  for (const [, p] of fs.readFileSync(path.join(ROOT, 'scripts/smoke.sh'), 'utf8').matchAll(/"\$BASE(\/[^"?]*)/g)) {
    urls.add(p.replaceAll('$$', '0'))
  }
  return [...urls].sort()
}

// --- Main ------------------------------------------------------------------------
const fail = (head, lines) => {
  console.error(`check-waf: ${head}\n  ${lines.join('\n  ')}`)
  process.exit(1)
}
const testFailures = selfTest()
if (testFailures.length) fail('the evaluator failed its self-test:', testFailures)
if (process.argv.includes('--self-test')) {
  console.log('check-waf: self-test ok')
  process.exit(0)
}

// Folded to single spaces, the way zone-rules.yml sends it.
const expr = fs.readFileSync(path.join(ROOT, EXPR_FILE), 'utf8').replace(/\s+/g, ' ').trim()
let rule
try {
  rule = parse(expr)
} catch (e) {
  fail(`${EXPR_FILE} does not parse:`, [e.message])
}
const COMBOS = MODELS.flatMap((m) => READINGS.map((r) => `${m}/${r}`))
const list = (combos) => (combos.length === COMBOS.length ? 'every model' : combos.join(' '))
const problems = []
if (expr.length > MAX_CHARS) problems.push(`${expr.length} chars after folding (limit ${MAX_CHARS})`)
if (rule.wildcards > MAX_WILDCARDS) problems.push(`${rule.wildcards} wildcard operators (limit ${MAX_WILDCARDS})`)
for (const s of rule.strings.filter((x) => /\s/.test(x))) {
  problems.push(`"${s}" has whitespace the folding would change`)
}
if (!fs.existsSync(path.join(ROOT, 'out'))) fail('out/ is missing — run `npm run build` first', problems)
const served = servedUrls()
for (const u of served) {
  const hits = blockedUnder(rule.ast, u)
  if (hits.length) {
    problems.push(`blocks served URL ${u} [${list(hits.map((h) => h.combo))}]: ${hits[0].why.join(', ')}`)
  }
}
for (const u of MUST_BLOCK) {
  const hits = blockedUnder(rule.ast, u).map((h) => h.combo)
  const missed = COMBOS.filter((c) => !hits.includes(c))
  if (missed.length) problems.push(`lets scanner path ${u} through [${list(missed)}]`)
}
if (problems.length) fail(`${EXPR_FILE} FAILED:`, problems)
console.log(
  `check-waf: OK — ${expr.length}/${MAX_CHARS} chars, ${rule.wildcards}/${MAX_WILDCARDS} wildcards; ` +
    `0 of ${served.length} served URLs blocked, all ${MUST_BLOCK.length} scanner paths blocked ` +
    `(${MODELS.length} normalizations × ${READINGS.length} extension readings)`,
)
