import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import StatusDashboard from '@/components/StatusDashboard'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Status – Dmytro Rozsoshnykh',
  description: 'Sanntids driftsstatus og oppetid for tjenestene.',
  alternates: { canonical: `${SITE_URL}/status/` },
}

export default function StatusPage() {
  return (
    <>
      <Header />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; Tilbake til forsiden
        </Link>

        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Status
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-10">
          Driftsstatus
        </h1>

        <StatusDashboard />
      </main>
      <Footer />
    </>
  )
}
