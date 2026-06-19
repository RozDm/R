'use client'

import { useState } from 'react'
import { copyText } from '@/lib/clipboard'

export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyText(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 ease-out"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span aria-live="polite">{copied ? 'Kopiert!' : 'Kopier lenke'}</span>
    </button>
  )
}
