// Who gets the "this site also speaks your language" hint (LangHint), from
// the browser's language list alone — nothing is sent anywhere.
import type { Lang } from './i18n'

// localStorage: '1' once the reader has closed the hint (or followed it).
export const LANG_HINT_KEY = 'lang-hint'

// Danes and Swedes read Norwegian; they get no hint on a Norwegian page.
const SCANDINAVIAN = /^(nb|nn|no|da|sv)(-|$)/i
const NORWEGIAN = /^(nb|nn|no)(-|$)/i

// On a Norwegian page: a reader with no Scandinavian language at all. On an
// English page: a reader whose first language is Norwegian. An empty list
// (some privacy modes) tells nothing — no hint.
export function wantsOtherLanguage(pageLang: Lang, languages: readonly string[]): boolean {
  if (languages.length === 0) return false
  return pageLang === 'nb' ? !languages.some((l) => SCANDINAVIAN.test(l)) : NORWEGIAN.test(languages[0])
}
