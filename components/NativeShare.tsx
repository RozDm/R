'use client'

import { useEffect, useState } from 'react'

// Native share sheet — only rendered where the Web Share API exists
// (in practice: phones and tablets), where it beats a row of links.
export default function NativeShare({ url, title }: { url: string; title: string }) {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) setSupported(true)
  }, [])

  if (!supported) return null

  return (
    <button
      onClick={() => {
        navigator.share({ url, title }).catch(() => {})
      }}
      className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="m16 6-4-4-4 4" />
        <path d="M12 2v13" />
      </svg>
      Mer…
    </button>
  )
}
