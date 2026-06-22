'use client'

import Link from 'next/link'
import type { MouseEventHandler, ReactNode } from 'react'

interface Props {
  href: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

// Slower than the browser's default ~500ms smooth scroll, with an ease-out-expo
// curve that matches the rest of the site's motion language — easier on the
// eye on the long home page where sections are far apart.
const SCROLL_DURATION_MS = 900
// Account for the sticky header (h-16 + a hair) so the section's heading
// isn't tucked under it after the scroll lands.
const SCROLL_OFFSET_PX = 72

// ease-out-expo: starts fast, settles softly — same curve as Intro / template.
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function smoothScrollTo(targetTop: number, duration: number): void {
  const start = window.scrollY
  const distance = targetTop - start
  if (distance === 0) return
  const startedAt = performance.now()
  const step = (now: number) => {
    const elapsed = now - startedAt
    const t = Math.min(elapsed / duration, 1)
    window.scrollTo(0, start + distance * easeOutExpo(t))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// Next 16's <Link href="/#x"> appends to the existing hash instead of replacing
// it when the target pathname matches the current one — clicking through the
// nav on / produces URLs like /#main#about#status. Intercept on the home page
// and run a custom smooth scroll so the experience matches the site's slower
// motion language. On other pages we leave Link's client-side navigation
// alone so e.g. /blogg -> /#about still works.
export default function HashLink({ href, className, children, onClick }: Props) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      const hash = href.split('#')[1]
      const target = hash ? document.getElementById(hash) : null
      if (hash && target) {
        e.preventDefault()
        // Update the URL bar without triggering the browser's own instant
        // jump (which would race the animation).
        history.pushState(null, '', `#${hash}`)
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX
        if (reduced) {
          window.scrollTo(0, top)
        } else {
          smoothScrollTo(top, SCROLL_DURATION_MS)
        }
        // Move focus to the target so keyboard users land where the eye does.
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
