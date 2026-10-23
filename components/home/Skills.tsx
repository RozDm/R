import { DICT } from '@/data/i18n'
import { skillGroups } from '@/data/skills'
import { pick, type Lang } from '@/lib/i18n'

export default function Skills({ lang }: { lang: Lang }) {
  const t = DICT[lang].skills
  return (
    <section id="skills" className="flex flex-col gap-8 animate-fade-in [animation-delay:150ms]">
      <div>
        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          {t.eyebrow}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {t.title}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {skillGroups.map((group) => (
          <div
            key={group.title.nb}
            // One card style for every group; the learning one only spans the
            // row (it's the odd seventh card) and carries its «pågår» badge.
            className={`group p-5 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500 ${
              group.learning ? 'sm:col-span-2' : ''
            }`}
          >
            <h3 className="font-mono text-sm text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
              {`// ${group.title[lang]}`}
              {group.learning && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-600 dark:text-red-400 tracking-wide uppercase">
                  {t.learning}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.items.map((entry) => {
                const item = pick(lang, entry)
                return (
                <span
                  key={item}
                  className="text-[12px] px-2.5 py-1 rounded-md border font-mono transition-colors border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400"
                >
                  {item}
                </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
