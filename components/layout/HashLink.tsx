'use client'

import Link from 'next/link'
import type { MouseEventHandler, ReactNode } from 'react'

interface Props {
  href: string
  className?: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

// Slower than the browser default, smooth, and offset for the sticky header.
const SCROLL_DURATION_MS = 700
const SCROLL_OFFSET_PX = 72

// ease-in-out-cubic: the natural curve for scrolling — accelerate, then
// decelerate. (expo's instant-start read as a "jump" here.)
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Custom rAF scroll. Critically, it forces `scroll-behavior: auto` for the
// duration: the global CSS sets `scroll-behavior: smooth`, and with that on
// every per-frame window.scrollTo() kicks off the browser's OWN smooth
// animation, so the two fight and the scroll stutters / appears to stall
// before moving. Restoring the inline style afterwards hands smooth back to
// the CSS for everything else (initial #hash loads, the /status redirect).
function smoothScrollTo(targetTop: number, duration: number, onDone: () => void): void {
  const start = window.scrollY
  const distance = targetTop - start
  if (Math.abs(distance) < 1) {
    onDone()
    return
  }
  const html = document.documentElement
  const prevBehavior = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'

  let cancelled = false
  const cancel = () => {
    cancelled = true
  }
  // Never trap the user: if they wheel/touch mid-flight, abandon the animation.
  window.addEventListener('wheel', cancel, { passive: true, once: true })
  window.addEventListener('touchstart', cancel, { passive: true, once: true })
  const finish = () => {
    html.style.scrollBehavior = prevBehavior
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('touchstart', cancel)
  }

  const startedAt = performance.now()
  const step = (now: number) => {
    if (cancelled) {
      finish()
      return
    }
    const t = Math.min((now - startedAt) / duration, 1)
    window.scrollTo(0, start + distance * easeInOutCubic(t))
    if (t < 1) {
      requestAnimationFrame(step)
    } else {
      finish()
      onDone()
    }
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
        // Update the URL bar without the browser's instant jump racing the
        // animation (pushState doesn't scroll; setting location.hash would).
        history.pushState(null, '', `#${hash}`)
        const top = target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX
        // Move focus to the section so keyboard users land where the eye does.
        const focusTarget = () => {
          target.setAttribute('tabindex', '-1')
          target.focus({ preventScroll: true })
        }
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduced) {
          window.scrollTo(0, top)
          focusTarget()
        } else {
          smoothScrollTo(top, SCROLL_DURATION_MS, focusTarget)
        }
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
