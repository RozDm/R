import ThemeToggle from './ThemeToggle'
import MobileMenu from './MobileMenu'

const navLinks = [
  { href: '#about', label: 'Om meg' },
  { href: '#skills', label: 'Ferdigheter' },
  { href: '#footer', label: 'Kontakt' },
]

export default function Header() {
  return (
    <header className="relative w-full py-4 px-4 md:px-8 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/50 dark:border-white/5 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <a href="#" className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          DR<span className="text-red-600">.</span>
        </a>
        <nav className="hidden md:flex items-center gap-8" aria-label="Hovednavigasjon">
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm tracking-wide"
            >
              {label}
            </a>
          ))}
          <ThemeToggle />
        </nav>
        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  )
}
