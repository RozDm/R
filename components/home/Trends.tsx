import TrendsChart from './LazyTrendsChart'

export default function Trends() {
  return (
    <section id="trender" className="flex flex-col gap-8 animate-fade-in [animation-delay:750ms]">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Trender
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Trafikk over tid
        </h2>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
          Sampled tidsserie fra Workers Analytics Engine — hvert punkt er
          antall besøk i et tidsrom. Tallet gjelder valgt periode; «Alt» viser
          det eksakte totaltallet fra D1, det samme som kartet over. Ingen
          informasjonskapsler, ingen sporing.
        </p>
      </div>
      <TrendsChart />
    </section>
  )
}
