import HashLink from '../layout/HashLink'

export default function Hero() {
  return (
    <section id="about" className="flex flex-col gap-6 pt-8 animate-fade-in">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-3">
          Systemadministrator · DevOps · Utvikler
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
          Dmytro
          <br />
          Rozsoshnykh
        </h1>
      </div>
      <p className="text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed text-lg">
        IT-spesialist innen systemadministrasjon, DevOps og nettverksinfrastruktur.
        Jeg optimaliserer infrastruktur, automatiserer prosesser og styrker sikkerhet —
        med solid forståelse for programmering og utvikling.
      </p>
      <div className="flex gap-4 pt-2">
        <HashLink
          href="/#skills"
          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide"
        >
          Min kompetanse
        </HashLink>
        <HashLink
          href="/#footer"
          className="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:border-gray-500 dark:hover:border-gray-500 transition text-sm font-medium tracking-wide"
        >
          Kontakt
        </HashLink>
      </div>
    </section>
  )
}
