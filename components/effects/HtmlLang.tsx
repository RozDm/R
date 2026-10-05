'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { HREFLANG, langFromPath } from '@/lib/i18n'

// One root layout serves both languages, so the static HTML always says
// <html lang="nb">. The Worker rewrites it to "en" for /en/ documents (what
// crawlers and screen readers see first); this keeps it right across
// client-side navigations between the two languages.
export default function HtmlLang() {
  const pathname = usePathname()
  useEffect(() => {
    document.documentElement.lang = HREFLANG[langFromPath(pathname)]
  }, [pathname])
  return null
}
