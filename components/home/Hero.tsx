import Link from 'next/link'
import HashLink from '../layout/HashLink'
import { DICT } from '@/data/i18n'
import { localePath, type Lang } from '@/lib/i18n'
import { SITE_COPY } from '@/lib/site'

export default function Hero({ lang }: { lang: Lang }) {
  const t = DICT[lang].hero
  return (
    // No fade-in here, unlike the sections below: this is the first screen, and
    // an opacity-0 start holds back its paint and so the LCP (CLAUDE.md).
    <section id="about" className="flex flex-col gap-6 pt-8">
      <div>
        {/* The roles wrap as whole words with no separator at a line break:
            each carries its own leading " · ", and the block is pulled left by
            exactly that width (3 monospace cells + their tracking) inside an
            overflow-hidden <p>, so the separator of whichever role starts a
            line is clipped. Smaller on phones, so all three fit one line from
            375 px (Norwegian). */}
        <p className="text-red-600 dark:text-red-400 font-mono text-xs sm:text-sm tracking-widest uppercase mb-3 overflow-hidden">
          <span className="block -ml-[calc(3ch+0.3em)]">
            {SITE_COPY[lang].roles.map((role) => (
              <span key={role} className="inline-block whitespace-nowrap">
                <span aria-hidden className="whitespace-pre">
                  {' · '}
                </span>
                {role}
              </span>
            ))}
          </span>
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
          Dmytro
          <br />
          Rozsoshnykh
        </h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed text-lg">
        {t.intro}
      </p>
      <div className="flex gap-4 pt-2">
        <HashLink
          href={localePath(lang, '/#skills')}
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide"
        >
          {t.ctaSkills}
        </HashLink>
        <Link
          href={localePath(lang, '/kontakt/')}
          className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:border-gray-500 dark:hover:border-gray-500 transition text-sm font-medium tracking-wide"
        >
          {t.ctaContact}
        </Link>
      </div>
    </section>
  )
}
