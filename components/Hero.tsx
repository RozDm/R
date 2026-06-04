export default function Hero() {
  return (
    <section id="about" className="flex flex-col gap-6 animate-fade-in">
      <div>
        <p className="text-primary-light dark:text-primary-dark font-medium mb-2">Hei, jeg heter</p>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
          Dmytro Rozsoshnykh
        </h1>
        <p className="mt-3 text-xl text-gray-500 dark:text-gray-400">
          Fullstack-utvikler
        </p>
      </div>
      <p className="text-gray-700 dark:text-gray-300 max-w-2xl leading-relaxed">
        Jeg bygger moderne webapplikasjoner med React, Next.js og TypeScript.
        Har også solid erfaring innen serverutvikling, DevOps og infrastruktur.
      </p>
      <div className="flex gap-4">
        <a
          href="#projects"
          className="px-6 py-3 bg-primary-light dark:bg-primary-dark text-white rounded-lg hover:opacity-90 transition font-medium"
        >
          Se prosjekter
        </a>
        <a
          href="#footer"
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition font-medium"
        >
          Kontakt meg
        </a>
      </div>
    </section>
  )
}
