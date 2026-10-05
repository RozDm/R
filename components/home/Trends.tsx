import TrendsChart from './LazyTrendsChart'
import { DICT } from '@/data/i18n'
import type { Lang } from '@/lib/i18n'

export default function Trends({ lang }: { lang: Lang }) {
  const t = DICT[lang].trends
  return (
    <section id="trender" className="flex flex-col gap-8 animate-fade-in [animation-delay:750ms]">
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
      <TrendsChart />
    </section>
  )
}
