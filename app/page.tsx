import Header from '@/components/Header'
import About from '@/components/About'
import Skills from '@/components/Skills'
import Projects from '@/components/Projects'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex flex-col gap-16">
        <About />
        <Skills />
        <Projects />
      </main>
      <Footer />
    </>
  )
}