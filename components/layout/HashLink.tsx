'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MouseEventHandler, ReactNode } from 'react'

interface Props {
  href: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
  title?: string
  hrefLang?: string
}

// The two front pages (/ and /en/): where the section links live.
const isFrontPage = (p: string) => p === '/' || p === '/en/' || p === '/en'

const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p)

// A plain page link (no #hash) marks itself as the current section: exact
// match → "page", a parent of the current page (Blogg while reading a post)
// → "true". Hash links never do — every one of them points at '/'.
function currentFor(href: string, pathname: string | null): 'page' | 'true' | undefined {
  if (!pathname || href.includes('#')) return undefined
  const target = trimSlash(href)
  const here = trimSlash(pathname)
  if (here === target) return 'page'
  if (target !== '/' && target !== '/en' && here.startsWith(`${target}/`)) return 'true'
  return undefined
}

// Next 16's <Link href="/#x"> appends to the existing hash instead of replacing
// it when the target pathname matches the current one — clicking through the
// nav on / produces URLs like /#main#about#status. Intercept on the home page
// and run the browser's native smooth scroll via scrollIntoView. The CSS sets
// `scroll-padding-top: 72px` (globals.css) so the section heading clears the
// sticky header — no manual offset math required. Custom rAF animations
// fought the global `scroll-behavior: smooth` and stuttered; the native path
// is the best practice in 2026 and doesn't need our help. On other pages we
// leave Link's client-side navigation alone so e.g. /blogg -> /#about works.
export default function HashLink({ href, className, children, onClick, title, hrefLang }: Props) {
  const pathname = usePathname()
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    const here = typeof window !== 'undefined' ? window.location.pathname : ''
    const [base] = href.split('#')
    // Only links into the front page we are on are handled here; a link to
    // the other language's front page is a normal navigation.
    const samePage = isFrontPage(here) && base === here
    if (samePage && !href.includes('#')) {
      // The logo on the home page: Next treats / → / as a no-op, so a reader
      // deep in the page clicked it and nothing happened. Back to the top,
      // dropping any #section from the URL.
      e.preventDefault()
      if (window.location.hash) history.pushState(null, '', here)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (samePage) {
      const hash = href.split('#')[1]
      const target = hash ? document.getElementById(hash) : null
      if (hash && target) {
        e.preventDefault()
        // pushState updates the URL without the browser's instant jump that
        // setting location.hash would trigger (which raced the smooth scroll).
        history.pushState(null, '', `#${hash}`)
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Move focus to the section so keyboard users land where the eye does.
        target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
      }
    }
    onClick?.(e)
  }
  return (
    <Link
      href={href}
      onClick={handleClick}
      className={className}
      title={title}
      hrefLang={hrefLang}
      aria-current={currentFor(href, pathname)}
    >
      {children}
    </Link>
  )
}
