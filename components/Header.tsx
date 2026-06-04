import ThemeToggle from './ThemeToggle'
import MobileMenu from './MobileMenu'

const navLinks = [
  { href: '#about', label: 'Om meg' },
  { href: '#skills', label: 'Ferdigheter' },
  { href: '#projects', label: 'Prosjekter' },
  { href: '#footer', label: 'Kontakt' },
]

export default function Header() {
  return (
    <header className="w-full py-4 px-4 md:px-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <a href="#" className="text-xl font-bold text-gray-900 dark:text-white">
          DR
        </a>
        <nav className="hidden md:flex items-center gap-6" aria-label="Hovednavigasjon">
          {navLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-gray-600 dark:text-gray-300 hover:text-primary-light dark:hover:text-primary-dark transition-colors text-sm font-medium"
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
