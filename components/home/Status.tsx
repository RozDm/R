import StatusDashboard from './StatusDashboard'

export default function Status() {
  return (
    <section id="status" className="flex flex-col gap-8 animate-fade-in [animation-delay:450ms]">
      <div>
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Status
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Driftsstatus
        </h2>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xl">
          Sanntidsovervåking av tjenestene mine — sjekkes hvert 5. minutt av en
          Cloudflare Worker (cron) og lagres i KV.
        </p>
      </div>
      <StatusDashboard />
    </section>
  )
}
