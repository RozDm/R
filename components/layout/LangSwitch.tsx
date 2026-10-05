'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DICT } from '@/data/i18n'
import { HREFLANG, langFromPath, switchPath } from '@/lib/i18n'

// NO ⇄ EN: the same page in the other language, or that language's front page
// when the page exists in one language only (the blog is Norwegian-only). The
// label is the other language's code, written in that language.
export default function LangSwitch() {
  const pathname = usePathname() ?? '/'
  const lang = langFromPath(pathname)
  const other = lang === 'nb' ? 'en' : 'nb'
  const t = DICT[lang].langSwitch
  return (
    <Link
      href={switchPath(pathname, other)}
      hrefLang={HREFLANG[other]}
      lang={HREFLANG[other]}
      title={t.title}
      // Starts with the visible text, so voice-control users can say "EN".
      aria-label={`${t.label} – ${t.title}`}
      className="flex items-center justify-center h-9 px-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-mono font-medium tracking-wider text-gray-600 dark:text-gray-300 transition-colors duration-200 ease-out"
    >
      {t.label}
    </Link>
  )
}
