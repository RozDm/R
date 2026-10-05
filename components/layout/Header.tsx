import HashLink from './HashLink'
import ThemeToggle from './ThemeToggle'
import MobileMenu from './MobileMenu'
import LangSwitch from './LangSwitch'
import { DICT } from '@/data/i18n'
import { localePath, type Lang } from '@/lib/i18n'

export interface NavLink {
  href: string
  label: string
  title?: string
  hrefLang?: string
}

function navLinks(lang: Lang): NavLink[] {
  const t = DICT[lang].nav
  return [
    { href: localePath(lang, '/#about'), label: t.about },
    { href: localePath(lang, '/#skills'), label: t.skills },
    { href: localePath(lang, '/#status'), label: t.status },
    { href: localePath(lang, '/blogg/'), label: t.blog },
    // The contact page, not the home footer: from /kontakt itself a /#footer
    // link navigated AWAY from the form it was labelled as.
    { href: localePath(lang, '/kontakt/'), label: t.contact },
  ]
}

// `alternate`: this page in the other language, when the page knows better
// than the static pairs (blog posts and tag pages pair dynamically).
export default function Header({ lang = 'nb', alternate }: { lang?: Lang; alternate?: string }) {
  const links = navLinks(lang)
  return (
    <header className="relative w-full py-4 px-4 md:px-8 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/50 dark:border-white/5 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <HashLink href={localePath(lang, '/')} className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          DR<span className="text-red-600">.</span>
        </HashLink>
        <nav className="hidden md:flex items-center gap-8" aria-label={DICT[lang].nav.label}>
          {links.map(({ href, label, title, hrefLang }) => (
            <HashLink
              key={href}
              href={href}
              title={title}
              hrefLang={hrefLang}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white [&[aria-current]]:text-gray-900 dark:[&[aria-current]]:text-white transition-colors duration-200 ease-out text-sm tracking-wide"
            >
              {label}
            </HashLink>
          ))}
          <LangSwitch href={alternate} />
          <ThemeToggle />
        </nav>
        <div className="flex items-center gap-3 md:hidden">
          <LangSwitch href={alternate} />
          <ThemeToggle />
          <MobileMenu links={links} />
        </div>
      </div>
    </header>
  )
}
