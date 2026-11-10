import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { outlineText } from '../scripts/build-diagrams.mjs'

// Post diagrams: public/images/ holds copies of content/diagrams/ with the
// text outlined in Intel One Mono (scripts/build-diagrams.mjs). A source
// edited without `npm run diagrams` fails here.
describe('diagrams', () => {
  it('every built copy matches its source', () => {
    let output = ''
    try {
      execFileSync(process.execPath, ['scripts/build-diagrams.mjs', '--check'], { encoding: 'utf8', stdio: 'pipe' })
    } catch (err) {
      output = String((err as { stderr?: string }).stderr || err)
    }
    expect(output).toBe('')
  })

  it('outlines text and shares each glyph, but refuses what it cannot draw', () => {
    const svg = (text: string) => `<svg width="10" height="10"><text x="0" y="9" font-size="10" fill="#000">${text}</text></svg>`
    const out = outlineText(svg('æ æ'), 'test')
    expect(out).not.toContain('<text')
    expect(out.match(/<path id=/g)).toHaveLength(1)
    expect(out.match(/<use /g)).toHaveLength(2)
    expect(() => outlineText(svg('<tspan>a</tspan>'), 'test')).toThrow(/tspan/)
    expect(() => outlineText(svg('🙂'), 'test')).toThrow(/has no/)
    expect(() => outlineText(svg('a').replace('<text', '<text class="x"'), 'test')).toThrow(/not supported/)
  })

  it('drops source comments, nested ones too, and refuses one that never closes', () => {
    expect(outlineText('<svg><!<!-- a -->-- b --></svg>', 'test')).not.toMatch(/<!--|-->|\ba\b|\bb\b/)
    expect(() => outlineText('<svg><!<!-- a -->--</svg>', 'test')).toThrow(/never closes/)
  })
})
