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

