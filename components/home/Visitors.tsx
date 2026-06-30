import GeoMap from './LazyGeoMap'

export default function Visitors() {
  return (
    <section id="besok" className="flex flex-col gap-8 animate-fade-in [animation-delay:600ms]">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Besøk
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Hvor leserne kommer fra
        </h2>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
          Landet hentes fra Cloudflare på kanten og telles i D1 — ingen
          informasjonskapsler, ingen sporing av enkeltpersoner.
        </p>
      </div>
      <GeoMap />
    </section>
  )
}
