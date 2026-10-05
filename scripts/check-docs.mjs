// Docs drift check: the agent docs (CLAUDE.md files, README, skills) must
// name only paths that exist, and must mention every module, route, workflow,
// script, skill and hook that does. Run by tests/docs.test.ts (so `npm test`,
// CI and deploy enforce it) and by the Stop hook (.claude/hooks/stop-docs.mjs)
// before a session ends. `node scripts/check-docs.mjs` prints the problems.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Backticked tokens that look like paths but aren't repo files: packages,
// git refs, GitHub actions, URLs the build or Worker serves.
const NOT_PATHS = new Set(['cloudflare/wrangler-action', 'origin/main', 'favicon.ico'])
const NOT_PATH_PREFIXES = ['next/', '@', 'node:', 'eslint-config-']
// Build output and installs — named in docs, absent in a fresh checkout.
const UNTRACKED_OK = ['out', '.next', 'node_modules', '.wrangler']
const FILE_EXT = /\.(tsx?|mjs|js|jsonc?|md|sh|ya?ml|sql|css|svg|woff2|xml|txt|png|ico)$/

function listFiles(root) {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  return out.split('\n').filter((f) => f && fs.existsSync(path.join(root, f)))
}

// `a/{b,c}.ts` → `a/b.ts`, `a/c.ts` (one level is all the docs use).
function expandBraces(token) {
  const m = token.match(/^(.*?)\{([^{}]+)\}(.*)$/)
  return m ? m[2].split(',').map((part) => `${m[1]}${part}${m[3]}`) : [token]
}

function pathTokens(text) {
  const prose = text.replace(/^```[\s\S]*?^```/gm, '')
  const tokens = []
  for (const [, raw] of prose.matchAll(/`([^`\n]+)`/g)) {
    const t = raw.trim()
    if (/^(https?:|\/)/.test(t) || /[\s<>*…$=(:,]/.test(t.replace(/\{[^{}]*\}/g, ''))) continue
    if (NOT_PATHS.has(t) || NOT_PATH_PREFIXES.some((p) => t.startsWith(p)) || /^\.\w+$/.test(t)) continue
    if (!t.includes('/') && !FILE_EXT.test(t)) continue
    tokens.push(...expandBraces(t))
  }
  return tokens
}

export function checkDocs(root = ROOT) {
  const files = listFiles(root)
  const fileSet = new Set(files)
  const dirSet = new Set()
  for (const f of files) {
    for (let d = path.posix.dirname(f); d !== '.'; d = path.posix.dirname(d)) dirSet.add(d)
  }
  const all = [...fileSet, ...dirSet]
  const names = new Set(all.map((p) => path.posix.basename(p)))
  const exists = (p) => fileSet.has(p) || dirSet.has(p)

  const read = (f) => (fileSet.has(f) ? fs.readFileSync(path.join(root, f), 'utf8') : '')
  const skills = files.filter((f) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f))
  const docs = ['CLAUDE.md', 'src/CLAUDE.md', '.github/CLAUDE.md', 'README.md', ...skills]
  const text = Object.fromEntries(docs.map((d) => [d, read(d)]))
  const anyDoc = (needle, among = ['CLAUDE.md', 'README.md', '.github/CLAUDE.md']) =>
    among.some((d) => text[d].includes(needle))

  const problems = []

  // 1. Every path a doc names exists.
  for (const doc of docs) {
    for (const token of pathTokens(text[doc])) {
      const p = token.replace(/^\.\//, '').replace(/\/$/, '')
      const ok =
        exists(p) ||
        exists(path.posix.join(path.posix.dirname(doc), p)) ||
        UNTRACKED_OK.includes(p.split('/')[0]) ||
        (p.includes('/') ? all.some((f) => f.endsWith(`/${p}`)) : names.has(p))
      if (!ok) problems.push(`${doc}: \`${token}\` does not exist`)
    }
  }

  // 2. Everything that exists is documented where a session will look for it.
  const ls = (dir, re) =>
    files
      .filter((f) => path.posix.dirname(f) === dir && re.test(path.posix.basename(f)))
      .map((f) => path.posix.basename(f))
  const subdirs = (dir) =>
    [...dirSet].filter((d) => path.posix.dirname(d) === dir).map((d) => path.posix.basename(d))
  const need = (cond, msg) => cond || problems.push(msg)

  for (const f of ls('src', /\.ts$/)) {
    need(text['src/CLAUDE.md'].includes(f), `src/CLAUDE.md: module src/${f} is not described`)
  }
  for (const f of ls('src/routes', /\.ts$/)) {
    const stem = f.replace(/\.ts$/, '')
    need(text['src/CLAUDE.md'].includes(`/api/${stem}`), `src/CLAUDE.md: route /api/${stem} is not in the API surface`)
    need(text['CLAUDE.md'].includes(`/api/${stem}`), `CLAUDE.md: endpoint /api/${stem} is not listed`)
  }
  for (const f of ls('lib', /\.tsx?$/)) {
    need(anyDoc(f, ['CLAUDE.md', 'README.md']), `README.md: lib/${f} is not in the layout`)
  }
  for (const d of subdirs('app')) {
    need(text['CLAUDE.md'].includes(d), `CLAUDE.md: app/${d} is not in the routes`)
  }
  for (const d of subdirs('app/en')) {
    need(text['CLAUDE.md'].includes(`en/${d}`), `CLAUDE.md: app/en/${d} is not in the routes`)
  }
  for (const f of ls('.github/workflows', /\.ya?ml$/)) {
    need(text['.github/CLAUDE.md'].includes(f), `.github/CLAUDE.md: workflow ${f} is not described`)
  }
  for (const f of ls('scripts', /./)) need(anyDoc(f), `script scripts/${f} is not mentioned in any doc`)
  for (const d of subdirs('.claude/skills')) need(anyDoc(d), `skill ${d} is not mentioned in any doc`)
  for (const f of ls('.claude/hooks', /./)) need(anyDoc(f), `hook .claude/hooks/${f} is not mentioned in any doc`)

  return problems
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkDocs()
  for (const p of problems) console.error(p)
  process.exit(problems.length ? 1 : 0)
}
