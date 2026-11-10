import type { Metadata } from 'next'
import Link from 'next/link'
import HalEye from '@/components/effects/HalEye'
import Eyebrow from '@/components/layout/Eyebrow'
import { DICT } from '@/data/i18n'
import { localePath, type Lang } from '@/lib/i18n'

// One 404.html answers every miss, /en/… included, so the page carries both
// languages. The head script in app/layout.tsx sets <html lang="en"> on /en/
// paths before the first paint, and CSS shows the matching copy: no flash of
// Norwegian on an English miss.
export const metadata: Metadata = { title: '404' }

const SHOW: Record<Lang, string> = {
  nb: 'flex [html[lang=en]_&]:hidden',
  en: 'hidden [html[lang=en]_&]:flex',
}

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {/* Static HAL 9000 eye (no animation) */}
      <HalEye look="page" className="mb-10" />

      {(['nb', 'en'] as const).map((lang) => {
        const t = DICT[lang]
        return (
          <div key={lang} lang={lang} className={`${SHOW[lang]} flex-col items-center`}>
            <Eyebrow className="mb-4">{t.notFound.eyebrow}</Eyebrow>

            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white max-w-2xl leading-tight">
              {t.notFound.title}
            </h1>

            <p className="mt-6 font-mono text-xs text-gray-500 dark:text-gray-400">{t.notFound.note}</p>

            <Link
              href={localePath(lang, '/')}
              className="mt-10 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide"
            >
              {t.backHome}
            </Link>
          </div>
        )
      })}
    </main>
  )
}
