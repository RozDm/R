import { describe, expect, it } from 'vitest'
import { readingTimeMinutes } from '@/lib/reading-time'

describe('readingTimeMinutes', () => {
  it('returns at least 1 minute for short posts', () => {
    expect(readingTimeMinutes('Kort tekst.')).toBe(1)
  })

  it('scales with word count (~200 wpm)', () => {
    expect(readingTimeMinutes('ord '.repeat(600))).toBe(3)
  })

  it('does not count fenced code blocks as prose', () => {
    const prose = 'ord '.repeat(200)
    const withCode = `${prose}\n\`\`\`bash\n${'kode '.repeat(800)}\n\`\`\``
    expect(readingTimeMinutes(withCode)).toBe(readingTimeMinutes(prose))
  })
})
