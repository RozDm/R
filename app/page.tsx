import Intro from '@/components/Intro'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Skills from '@/components/Skills'
import Certifications from '@/components/Certifications'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Intro />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Hopp til hovedinnhold
      </a>
      <Header />
      <main id="main" className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col gap-24 py-20">
        <Hero />
        <Skills />
        <Certifications />
      </main>
      <Footer />
    </>
  )
}
