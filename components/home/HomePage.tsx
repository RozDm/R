import Intro from '@/components/effects/Intro'
import LazyHalIdle from '@/components/effects/LazyHalIdle'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import Hero from './Hero'
import Skills from './Skills'
import Certifications from './Certifications'
import Status from './Status'
import Visitors from './Visitors'
import Trends from './Trends'
import { DICT } from '@/data/i18n'
import type { Lang } from '@/lib/i18n'

// The front page, shared by / (Norwegian) and /en/ (English).
export default function HomePage({ lang }: { lang: Lang }) {
  return (
    <>
      <Intro />
      <LazyHalIdle />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        {DICT[lang].skipToContent}
      </a>
      <Header lang={lang} />
      <main id="main" className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col gap-24 py-20">
        <Hero lang={lang} />
        <Skills lang={lang} />
        <Certifications lang={lang} />
        <Status lang={lang} />
        <Visitors lang={lang} />
        <Trends lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  )
}
