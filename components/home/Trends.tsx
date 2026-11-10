import TrendsChart from './LazyTrendsChart'
import SectionHeading from './SectionHeading'
import { DICT } from '@/data/i18n'
import type { Lang } from '@/lib/i18n'

export default function Trends({ lang }: { lang: Lang }) {
  const t = DICT[lang].trends
  return (
    <section id="trender" className="flex flex-col gap-8 animate-fade-in [animation-delay:750ms]">
      <SectionHeading eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <TrendsChart />
    </section>
  )
}
