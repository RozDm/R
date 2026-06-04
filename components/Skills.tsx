import { skillGroups } from '@/data/skills'

export default function Skills() {
  return (
    <section id="skills" className="flex flex-col gap-8 animate-fade-in">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Kompetanse
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Teknologistack
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {skillGroups.map((group) => (
          <div
            key={group.title}
            className={`group p-5 bg-white dark:bg-gray-900/50 rounded-xl transition-all duration-500 ${
              group.learning
                ? 'sm:col-span-2 border border-dashed border-gray-300 dark:border-gray-700'
                : 'border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20'
            }`}
          >
            <h3 className="font-mono text-sm text-red-500 dark:text-red-400 mb-4 flex items-center gap-2">
              // {group.title}
              {group.learning && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-500/70 dark:text-red-400/70 tracking-wide uppercase">
                  pågår
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <span
                  key={item}
                  className={`text-[12px] px-2.5 py-1 rounded-md border font-mono transition-colors ${
                    group.learning
                      ? 'border-gray-200 dark:border-gray-700/60 text-gray-500 dark:text-gray-400 border-dashed hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-400'
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
