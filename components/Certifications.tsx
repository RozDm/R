import { certifications } from '@/data/certifications'

export default function Certifications() {
  return (
    <section id="certifications" className="flex flex-col gap-8 animate-fade-in [animation-delay:300ms]">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Sertifiseringer
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Kurs &amp; sertifiseringer
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {certifications.map((cert) => (
          <div
            key={cert.title}
            className="flex items-start gap-3 p-4 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500"
          >
            <span className="font-mono text-red-500 dark:text-red-400 mt-0.5 select-none">›</span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
                {cert.title}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">
                {cert.issuer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
