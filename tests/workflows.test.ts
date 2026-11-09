import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pkg from '../package.json'

// Every action is pinned to a full commit SHA, with the release it is in a
// comment: a tag can be moved to other code, a SHA can't, and the comment is
// what Dependabot reads to propose (and re-pin) the next release.
const DIR = '.github/workflows'
const PINNED = /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/

describe('GitHub Actions', () => {
  it('pins every `uses:` to a commit SHA with its version comment', () => {
    const uses: string[] = []
    for (const file of readdirSync(DIR).filter((f) => f.endsWith('.yml'))) {
      for (const line of readFileSync(join(DIR, file), 'utf8').split('\n')) {
        const m = line.match(/^\s*(?:-\s+)?uses:\s*(.+?)\s*$/)
        if (m) uses.push(`${file}: ${m[1]}`)
      }
    }
    expect(uses.length).toBeGreaterThan(0)
    for (const u of uses) expect(u.split(': ')[1], u).toMatch(PINNED)
  })
})

// ci.yml runs in the Playwright image; its browsers are the ones the pinned
// @playwright/test drives, so the tag must name that version (a mismatch
// fails every e2e test with "Executable doesn't exist"), pinned by digest.
describe('ci.yml', () => {
  it('runs in the Playwright image of the pinned @playwright/test version', () => {
    const ci = readFileSync(join(DIR, 'ci.yml'), 'utf8')
    const image = ci.match(/image:\s*mcr\.microsoft\.com\/playwright:v([\d.]+)-\w+@sha256:[0-9a-f]{64}\s*$/m)
    expect(image, 'container image with a version tag and a digest').not.toBeNull()
    expect(image![1]).toBe(pkg.devDependencies['@playwright/test'])
    expect(pkg.devDependencies['playwright-core']).toBe(pkg.devDependencies['@playwright/test'])
  })
})

// Every secret lives in the `production` environment, deployable from `main`
// only (.github/CLAUDE.md, "Secrets"), so only main's code ever gets one. The
// workflow side of that: a job reading a secret names the environment, its
// workflow starts only from a push to main, a manual run or the schedule, no
// workflow runs base-repo code on PR input (`pull_request_target`,
// `workflow_run`), and no GITHUB_TOKEN can write.
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.yml'))
const read = (file: string) => readFileSync(join(DIR, file), 'utf8')

/** The lines of a top-level block (`on:`, `jobs:`) up to the next top-level key. */
function block(yml: string, key: string): string[] {
  const lines = yml.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`${key}:`))
  if (start < 0) return []
  const end = lines.findIndex((l, i) => i > start && /^[^\s#]/.test(l))
  return lines.slice(start + 1, end < 0 ? undefined : end)
}

/** A block's direct children (two-space keys) with their bodies. */
function children(lines: string[]): Map<string, string> {
  const out = new Map<string, string>()
  let name = ''
  for (const line of lines) {
    const m = line.match(/^ {2}([\w-]+):/)
    if (m) name = m[1]
    if (name) out.set(name, `${out.get(name) ?? ''}${line}\n`)
  }
  return out
}

describe('workflow secrets', () => {
  it('reads secrets only in jobs of the production environment', () => {
    let jobs = 0
    for (const file of FILES) {
      const yml = read(file)
      expect(yml, `${file}: secrets: inherit`).not.toMatch(/secrets:\s*inherit/)
      for (const [job, body] of children(block(yml, 'jobs'))) {
        if (!/secrets\.(?!GITHUB_TOKEN\b)\w/.test(body)) continue
        jobs++
        expect(body, `${file}: job ${job}`).toMatch(/^ {4}environment: production\s*$/m)
      }
    }
    expect(jobs).toBeGreaterThan(0)
  })

  it('starts production jobs only from a push to main, a manual run or the schedule', () => {
    for (const file of FILES) {
      const yml = read(file)
      const on = children(block(yml, 'on'))
      expect(on.size, `${file}: triggers`).toBeGreaterThan(0)
      expect([...on.keys()], file).not.toContain('pull_request_target')
      expect([...on.keys()], file).not.toContain('workflow_run')
      if (!/^ {4}environment:/m.test(yml)) continue
      for (const [event, body] of on) {
        expect(['push', 'workflow_dispatch', 'schedule'], `${file}: on ${event}`).toContain(event)
        if (event === 'push') expect(body, `${file}: on push`).toMatch(/^ {4}branches: \[main\]\s*$/m)
      }
    }
  })

  it('gives every GITHUB_TOKEN read-only scopes', () => {
    for (const file of FILES) {
      const yml = read(file)
      expect(yml, `${file}: top-level permissions`).toMatch(/^permissions:/m)
      expect(yml, file).not.toMatch(/:\s*write(-all)?\b/)
    }
  })
})

