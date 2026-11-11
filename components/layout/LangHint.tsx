'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { DICT } from '@/data/i18n'
import { HREFLANG, langFromPath, switchPath } from '@/lib/i18n'
import { LANG_HINT_KEY, wantsOtherLanguage } from '@/lib/lang-hint'

const subscribeToNothing = () => () => {}

function isClosed(): boolean {
  try {
    return localStorage.getItem(LANG_HINT_KEY) === '1'
  } catch {
    return false
  }
}

// One line under the header for a reader who landed on the language they
// probably don't read (lib/lang-hint.ts): a link to the other one, never a
// redirect. It leads where the NO/EN switch leads (`href`: a blog page's
// twin), and is written in the language it offers. Closed once, it stays
// closed (localStorage). It hangs below the header (absolute), so showing it
// after hydration moves nothing on the page; the intro's overlay covers it.
export default function LangHint({ href }: { href?: string }) {
  const pathname = usePathname() ?? '/'
  const lang = langFromPath(pathname)
  const other = lang === 'nb' ? 'en' : 'nb'
  // Read on the client only (the export's HTML never has it), without an
  // effect: the store is the browser's own state and never changes under us.
  const wanted = useSyncExternalStore(
    subscribeToNothing,
    () => !isClosed() && wantsOtherLanguage(lang, navigator.languages ?? []),
    () => false,
  )
  const [closed, setClosed] = useState(false)

  if (!wanted || closed) return null
  const t = DICT[lang].langHint
  const close = () => {
    setClosed(true)
    try {
      localStorage.setItem(LANG_HINT_KEY, '1')
    } catch {}
  }

  return (
    <div
      lang={HREFLANG[other]}
      className="absolute top-full inset-x-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4 text-sm">
        <Link
          href={href ?? switchPath(pathname, other)}
          prefetch={false}
          hrefLang={HREFLANG[other]}
          onClick={close}
          className="py-2.5 text-red-600 dark:text-red-400 underline underline-offset-4 hover:text-red-700 dark:hover:text-red-300 transition-colors"
        >
          {t.text} &rarr;
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label={t.close}
          className="flex items-center justify-center w-10 h-10 -mr-2.5 text-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <span aria-hidden>&times;</span>
        </button>
      </div>
    </div>
  )
}
