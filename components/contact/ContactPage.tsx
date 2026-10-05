import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ContactForm from './ContactForm'
import { DICT } from '@/data/i18n'
import { localePath, type Lang } from '@/lib/i18n'

// The contact page, shared by /kontakt/ and /en/contact/.
export default function ContactPage({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  return (
    <>
      <Header lang={lang} />
      <main id="main" className="max-w-3xl mx-auto px-4 md:px-8 py-20 min-h-[70vh]">
        <Link
          href={localePath(lang, '/')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors mb-8"
        >
          &larr; {t.backHome}
        </Link>

        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase mb-2">
          {t.contact.eyebrow}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {t.contact.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-xl">{t.contact.lead}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10 max-w-xl">
          {t.contact.privacyBefore}
          <Link
            href={localePath(lang, '/personvern/')}
            className="text-red-600 dark:text-red-400 underline underline-offset-2 hover:decoration-2"
          >
            {t.contact.privacyLink}
          </Link>
          {t.contact.privacyAfter}
        </p>

        <ContactForm />
      </main>
      <Footer lang={lang} />
    </>
  )
}
