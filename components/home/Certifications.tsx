import { certifications } from '@/data/certifications'
import { DICT } from '@/data/i18n'
import { pick, type Lang } from '@/lib/i18n'

export default function Certifications({ lang }: { lang: Lang }) {
  const t = DICT[lang].certs
  return (
    <section id="certifications" className="flex flex-col gap-8 animate-fade-in [animation-delay:300ms]">
      <div>
        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          {t.eyebrow}
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {t.title}
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {certifications.map((cert) => (
          <div
            key={pick('nb', cert.title)}
            className="flex items-start gap-3 p-4 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500"
          >
            <span className="font-mono text-red-600 dark:text-red-400 mt-0.5 select-none">›</span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
                {pick(lang, cert.title)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                {pick(lang, cert.issuer)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
