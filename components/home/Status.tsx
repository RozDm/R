import StatusDashboard from './LazyStatusDashboard'
import SectionHeading from './SectionHeading'
import { DICT } from '@/data/i18n'
import type { Lang } from '@/lib/i18n'

export default function Status({ lang }: { lang: Lang }) {
  const t = DICT[lang].status
  return (
    <section id="status" className="flex flex-col gap-8 animate-fade-in [animation-delay:450ms]">
      <SectionHeading eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <StatusDashboard />
    </section>
  )
}
