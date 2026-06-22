'use client'

import Link from 'next/link'
import type { MouseEventHandler, ReactNode } from 'react'

interface Props {
  href: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
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
export default function HashLink({ href, className, children, onClick }: Props) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
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
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  )
}
