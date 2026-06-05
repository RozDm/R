import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {/* Static HAL 9000 eye (no animation) */}
      <div className="relative mb-10" aria-hidden>
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[radial-gradient(circle,#ff2020_0%,#cc0000_25%,#800000_45%,#3d0000_65%,#1a0a0a_100%)] shadow-[0_0_50px_10px_rgba(255,0,0,0.2)]" />
        <div className="absolute inset-[34%] rounded-full bg-[radial-gradient(circle,rgba(255,200,100,0.9)_0%,rgba(255,50,0,0.6)_100%)]" />
      </div>

      <p className="font-mono text-sm tracking-[0.3em] text-red-500 dark:text-red-400 uppercase mb-4">
        Feil 404
      </p>

      <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white max-w-2xl leading-tight">
        Beklager %username%. Jeg er redd jeg ikke kan finne den siden.
      </h1>

      <p className="mt-6 font-mono text-xs text-gray-400 dark:text-gray-600">
        // this page could not be found
      </p>

      <Link
        href="/"
        className="mt-10 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition text-sm font-medium tracking-wide"
      >
        Tilbake til forsiden
      </Link>
    </main>
  )
}
