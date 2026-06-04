export default function Hero() {
  return (
    <section id="about" className="flex flex-col gap-6 pt-8 animate-fade-in">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-3">
          Fullstack-utvikler
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
          Dmytro
          <br />
          Rozsoshnykh
        </h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 max-w-lg leading-relaxed text-lg">
        Jeg bygger moderne webapplikasjoner med React, Next.js og TypeScript.
        Solid erfaring innen serverutvikling, DevOps og infrastruktur.
      </p>
      <div className="flex gap-4 pt-2">
        <a
          href="#projects"
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide"
        >
          Se prosjekter
        </a>
        <a
          href="#footer"
          className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:border-gray-500 dark:hover:border-gray-500 transition text-sm font-medium tracking-wide"
        >
          Kontakt
        </a>
      </div>
    </section>
  )
}
