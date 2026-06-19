import Intro from '@/components/effects/Intro'
import HalIdle from '@/components/effects/HalIdle'
import Header from '@/components/layout/Header'
import Hero from '@/components/home/Hero'
import Skills from '@/components/home/Skills'
import Certifications from '@/components/home/Certifications'
import Status from '@/components/home/Status'
import Visitors from '@/components/home/Visitors'
import Trends from '@/components/home/Trends'
import Footer from '@/components/layout/Footer'

export default function Home() {
  return (
    <>
      <Intro />
      <HalIdle />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Hopp til hovedinnhold
      </a>
      <Header />
      <main id="main" className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col gap-24 py-20">
        <Hero />
        <Skills />
        <Certifications />
        <Status />
        <Visitors />
        <Trends />
      </main>
      <Footer />
    </>
  )
}
