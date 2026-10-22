import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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
