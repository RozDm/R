#!/usr/bin/env node
// Stop hook: don't let a session finish with stale docs. Blocks once (the
// model gets the reason and either fixes the docs or says why not) when
//   - scripts/check-docs.mjs reports a problem, or
//   - this branch adds/removes/renames files under app/, components/, lib/,
//     src/, scripts/, workflows, skills or hooks without touching any doc.
// Fails open: no git, no origin/main or any error → let the stop through.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
  if (input.stop_hook_active) process.exit(0)

  const base = git('merge-base', 'HEAD', 'origin/main')
  // Committed + uncommitted changes against the branch point, plus untracked files.
  const changes = git('diff', '--name-status', '-M', base)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split('\t')
      return { status: status[0], paths }
    })
  for (const f of git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) {
    changes.push({ status: 'A', paths: [f] })
  }
  if (!changes.length) process.exit(0)

  const STRUCTURE = /^(app|components|lib|src|scripts|\.github\/workflows|\.claude\/(skills|hooks))\//
  const DOCS = /(^|\/)(CLAUDE|README)\.md$|^docs\/|^\.claude\/skills\/.+\/SKILL\.md$/
  const structural = changes
    .filter((c) => 'ADR'.includes(c.status) && c.paths.some((p) => STRUCTURE.test(p)))
    .map((c) => `${c.status} ${c.paths.join(' → ')}`)
  const docsTouched = changes.some((c) => c.paths.some((p) => DOCS.test(p)))

  const { checkDocs } = await import(path.join(root, 'scripts/check-docs.mjs'))
  const problems = checkDocs(root)

  const reasons = []
  if (problems.length) reasons.push(`scripts/check-docs.mjs found doc drift:\n${problems.join('\n')}`)
  if (structural.length && !docsTouched) {
    reasons.push(
      `This branch changes the file structure but no doc:\n${structural.join('\n')}\n` +
        'Update the matching CLAUDE.md / README (see "Where the rules live"), or say why none applies.',
    )
  }
  if (reasons.length) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: reasons.join('\n\n') }))
  }
} catch {
  // fail open
}
