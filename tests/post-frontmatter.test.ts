import { describe, expect, it } from 'vitest'
import matter from 'gray-matter'
import { parseFrontmatter } from '@/lib/post-frontmatter'

// The frontmatter as YAML, the way a post file carries it (gray-matter turns
// it into the object lib/blog.ts hands over).
const parse = (yaml: string, lang: 'nb' | 'en' = 'nb') =>
  parseFrontmatter(matter(`---\n${yaml}\n---\nTekst.\n`).data, lang, 'content/blog/x.md')

const DESCRIPTION = 'En beskrivelse som er lang nok til et søkeresultat eller en lenke.'
const post = (extra = '', { tags = '["Linux"]', date = '"2026-11-09"' } = {}) =>
  `title: "Tittel"\ndescription: "${DESCRIPTION}"\ndate: ${date}\ntags: ${tags}${extra ? `\n${extra}` : ''}`

describe('parseFrontmatter', () => {
  it('takes a well-formed post', () => {
    expect(parse(post())).toEqual({
      title: 'Tittel',
      description: DESCRIPTION,
      date: '2026-11-09',
      updated: undefined,
      tags: ['Linux'],
      draft: false,
      translationOf: undefined,
    })
    expect(parse(post('draft: true\nupdated: "2026-11-20"'))).toMatchObject({ draft: true, updated: '2026-11-20' })
  })

  it('canonicalises tags and drops duplicates', () => {
    expect(parse(post('', { tags: '["linux", "LINUX", "k8s", "Security"]' })).tags).toEqual([
      'Linux',
      'Kubernetes',
      'Sikkerhet',
    ])
  })

  it('reads an unquoted date as the same day', () => {
    expect(parse(post('updated: 2026-12-01', { date: '2026-11-09' }))).toMatchObject({
      date: '2026-11-09',
      updated: '2026-12-01',
    })
  })

  // Each of these used to publish the draft.
  it.each(['draft: "true"', 'draft: yes', 'draft: 1'])('refuses %s', (line) => {
    expect(() => parse(post(line))).toThrow(/draft: true or false, without quotes/)
  })

  it('refuses a field it does not know (a misspelt draft)', () => {
    expect(() => parse(post('draf: true'))).toThrow(/unknown field «draf»/)
  })

  it('refuses a tag outside data/tags.ts and tags not written as a list', () => {
    expect(() => parse(post('', { tags: '["Linux", "Dokcer"]' }))).toThrow(/"Dokcer" is not in STANDARD_TAGS/)
    expect(() => parse(post('', { tags: 'Linux, Docker' }))).toThrow(/tags: a list of at least one tag/)
    expect(() => parse(post('', { tags: '[]' }))).toThrow(/tags: a list of at least one tag/)
  })

  it('needs a title, a description and a real date', () => {
    expect(() => parse(`description: "${DESCRIPTION}"\ndate: "2026-11-09"\ntags: ["Linux"]`)).toThrow(
      /title: required text/,
    )
    expect(() => parse('title: "T"\ndate: "2026-11-09"\ntags: ["Linux"]')).toThrow(/description: required text/)
    expect(() => parse(post('', { date: '"9. november 2026"' }))).toThrow(/date: required, "YYYY-MM-DD"/)
    expect(() => parse(post('', { date: '"2026-02-30"' }))).toThrow(/date: required, "YYYY-MM-DD"/)
  })

  it('refuses an `updated` before `date`', () => {
    expect(() => parse(post('updated: "2026-11-01"'))).toThrow(/updated \(2026-11-01\) is before date \(2026-11-09\)/)
  })

  it('keeps the description within what a search result shows', () => {
    const description = (n: number) => `title: "T"\ndescription: "${'a'.repeat(n)}"\ndate: "2026-11-09"\ntags: ["Linux"]`
    expect(() => parse(description(50))).not.toThrow()
    expect(() => parse(description(160))).not.toThrow()
    expect(() => parse(description(49))).toThrow(/description: 49 characters, keep it within 50–160/)
    expect(() => parse(description(161))).toThrow(/description: 161 characters/)
  })

  it('takes translationOf from English posts only', () => {
    expect(parse(post('translationOf: "velkommen"'), 'en').translationOf).toBe('velkommen')
    expect(() => parse(post('translationOf: "velkommen"'), 'nb')).toThrow(/only an English post/)
  })

  it('names the file and every problem at once', () => {
    expect(() => parse('title: "T"\ndraft: "false"\ntags: ["Linux"]')).toThrow(
      /^content\/blog\/x\.md: .*description: required.*date: required.*draft: true or false/,
    )
  })
})
