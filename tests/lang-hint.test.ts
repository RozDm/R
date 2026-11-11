import { describe, expect, it } from 'vitest'
import { wantsOtherLanguage } from '../lib/lang-hint'

describe('wantsOtherLanguage', () => {
  it('on a Norwegian page: readers with no Scandinavian language', () => {
    expect(wantsOtherLanguage('nb', ['en-US', 'en'])).toBe(true)
    expect(wantsOtherLanguage('nb', ['uk-UA', 'ru', 'en'])).toBe(true)
    expect(wantsOtherLanguage('nb', ['nb-NO', 'en'])).toBe(false)
    expect(wantsOtherLanguage('nb', ['en-US', 'no'])).toBe(false)
    // Danes and Swedes read Norwegian.
    expect(wantsOtherLanguage('nb', ['da-DK'])).toBe(false)
    expect(wantsOtherLanguage('nb', ['sv'])).toBe(false)
    // …and a prefix is not a language: Northern Sotho, Navajo.
    expect(wantsOtherLanguage('nb', ['nso', 'nv'])).toBe(true)
  })

  it('on an English page: readers whose first language is Norwegian', () => {
    expect(wantsOtherLanguage('en', ['nb-NO', 'en'])).toBe(true)
    expect(wantsOtherLanguage('en', ['nn'])).toBe(true)
    expect(wantsOtherLanguage('en', ['en-GB', 'nb'])).toBe(false)
    expect(wantsOtherLanguage('en', ['sv-SE'])).toBe(false)
  })

  it('says nothing to a browser that names no language', () => {
    expect(wantsOtherLanguage('nb', [])).toBe(false)
    expect(wantsOtherLanguage('en', [])).toBe(false)
  })
})
