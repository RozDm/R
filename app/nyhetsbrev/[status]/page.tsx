import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { SITE_URL } from '@/lib/site'

interface Props {
  params: Promise<{ status: string }>
}

// Static-export route table. Kept literal here (not shared with the worker)
// because the app tsconfig excludes src/ — the worker constructs these URLs
// with string literals, so the two sides stay in sync by convention.
const STATUSES = ['bekreftet', 'avmeldt', 'ugyldig'] as const
type Status = (typeof STATUSES)[number]

export function generateStaticParams() {
  return STATUSES.map((status) => ({ status }))
}

interface Copy {
  title: string
  eyebrow: string
  body: string
  cta?: { href: string; label: string }
  tone: 'ok' | 'warn'
}

const COPY: Record<Status, Copy> = {
  bekreftet: {
    eyebrow: 'Bekreftet',
    title: 'Du står på listen',
    body:
      'Takk! Adressen din er nå bekreftet. Du får en kort e-post når nye ' +
      'artikler kommer ut — ingen sporing, ingen markedsføring.',
    cta: { href: '/blogg/', label: 'Les artikler' },
    tone: 'ok',
  },
  avmeldt: {
    eyebrow: 'Avmeldt',
    title: 'Adressen er fjernet',
    body:
      'Du er nå avmeldt nyhetsbrevet, og adressen er slettet fra listen. ' +
      'Du kan melde deg på igjen når som helst fra bloggsiden.',
    cta: { href: '/blogg/', label: 'Tilbake til bloggen' },
    tone: 'ok',
  },
  ugyldig: {
    eyebrow: 'Ugyldig lenke',
    title: 'Lenken virker ikke lenger',
    body:
      'Lenken er enten brukt opp, utløpt eller hører ikke til en aktiv ' +
      'adresse. Prøv å abonnere på nytt fra bloggsiden hvis du fortsatt ' +
      'vil stå på listen.',
    cta: { href: '/blogg/', label: 'Til bloggen' },
    tone: 'warn',
  },
}

function copyFor(status: string): Copy | null {
  return (STATUSES as readonly string[]).includes(status) ? COPY[status as Status] : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { status } = await params
  const copy = copyFor(status)
  if (!copy) return {}
  return {
    title: `Nyhetsbrev — ${copy.eyebrow}`,
    // Result page is the landing for an email link — never an indexable surface.
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE_URL}/nyhetsbrev/${status}/` },
  }
}

export default async function NewsletterResultPage({ params }: Props) {
  const { status } = await params
  const copy = copyFor(status)
  if (!copy) notFound()

  const toneBorder =
    copy.tone === 'ok'
      ? 'border-green-500/30 bg-green-500/5'
      : 'border-yellow-500/30 bg-yellow-500/5'

  return (
    <>
      <Header />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href="/blogg/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; Tilbake til bloggen
        </Link>

        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          Nyhetsbrev
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
          {copy.title}
        </h1>

        <div className={`rounded-xl border ${toneBorder} px-5 py-4 text-sm text-gray-700 dark:text-gray-200 max-w-xl`}>
          {copy.body}
        </div>

        {copy.cta && (
          <Link
            href={copy.cta.href}
            className="inline-block mt-8 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-80 transition-opacity duration-200 ease-out text-sm font-medium tracking-wide"
          >
            {copy.cta.label}
          </Link>
        )}
      </main>
      <Footer />
    </>
  )
}
