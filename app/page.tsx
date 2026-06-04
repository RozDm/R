import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Skills from '@/components/Skills'
import Projects from '@/components/Projects'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Hopp til hovedinnhold
      </a>
      <Header />
      <main id="main" className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col gap-20 py-16">
        <Hero />
        <Skills />
        <Projects />
      </main>
      <Footer />
    </>
  )
}
