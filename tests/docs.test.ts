import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

// The agent docs are part of the build: a stale path or an undocumented
// module, route, workflow, script, skill or hook fails `npm test` (and so CI
// and the deploy). The logic lives in scripts/check-docs.mjs, shared with the
// Stop hook.
describe('docs', () => {
  it('name only existing paths and cover every module, route, workflow, script, skill and hook', () => {
    let output = ''
    try {
      execFileSync(process.execPath, ['scripts/check-docs.mjs'], { encoding: 'utf8', stdio: 'pipe' })
    } catch (err) {
      output = String((err as { stderr?: string }).stderr || err)
    }
    expect(output).toBe('')
  })
})
