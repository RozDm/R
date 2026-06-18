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
// and let the browser set the hash natively (replaces existing hash, triggers
// the anchor scroll). On other pages we leave Link's client-side navigation
// alone so e.g. /blogg -> /#about still works.
export default function HashLink({ href, className, children, onClick }: Props) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      const hash = href.split('#')[1]
      if (hash) {
        e.preventDefault()
        window.location.hash = hash
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
