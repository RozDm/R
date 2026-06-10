import { describe, expect, it } from 'vitest'
import { normalizeTag, normalizeTags } from '@/lib/tags'

describe('normalizeTag', () => {
  it('canonicalises a known tag with different casing', () => {
    expect(normalizeTag('devops')).toBe('DevOps')
    expect(normalizeTag('LINUX')).toBe('Linux')
  })

  it('resolves aliases', () => {
    expect(normalizeTag('k8s')).toBe('Kubernetes')
    expect(normalizeTag('nodejs')).toBe('Node.js')
    expect(normalizeTag('overvaking')).toBe('Overvåking')
  })

  it('capitalises unknown tags but preserves inner casing', () => {
    expect(normalizeTag('kunstig intelligens')).toBe('Kunstig intelligens')
  })

  it('returns empty string for blank input', () => {
    expect(normalizeTag('   ')).toBe('')
  })
})

describe('normalizeTags', () => {
  it('deduplicates after normalisation', () => {
    expect(normalizeTags(['devops', 'DevOps', 'dev-ops'])).toEqual(['DevOps'])
  })

  it('returns empty array for non-array input', () => {
    expect(normalizeTags(undefined)).toEqual([])
    expect(normalizeTags('linux')).toEqual([])
  })

  it('skips non-string and empty entries', () => {
    expect(normalizeTags(['linux', 42, '', null])).toEqual(['Linux'])
  })
})
