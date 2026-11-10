import Eyebrow from '@/components/layout/Eyebrow'

// How every front-page section opens: the eyebrow, the h2 and, where the
// section explains itself, a lead. A server component, like the sections
// that use it: the headings of the code-split widgets (Driftsstatus, Hvor
// leserne kommer fra, Trafikk over tid) must be in the page's HTML —
// scripts/smoke.sh greps them.
export default function SectionHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {lead && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xl">{lead}</p>}
    </div>
  )
}
