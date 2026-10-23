import GeoMap from './LazyGeoMap'
import { DICT } from '@/data/i18n'
import type { Lang } from '@/lib/i18n'

export default function Visitors({ lang }: { lang: Lang }) {
  const t = DICT[lang].visitors
  return (
    <section id="besok" className="flex flex-col gap-8 animate-fade-in [animation-delay:600ms]">
      <div>
        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          {t.eyebrow}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {t.title}
        </h2>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
          {t.lead}
        </p>
      </div>
      {/* The same card as Driftsstatus and Trafikk over tid around it. */}
      <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 md:p-6 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500">
        <GeoMap />
      </div>
    </section>
  )
}
