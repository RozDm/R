'use client'

import { useState } from 'react'
import { copyText } from '@/lib/clipboard'

// Click copies the address to the clipboard (mailto handlers are unreliable
// on desktops without a default mail app). Right-click still exposes the
// mailto via the wrapping anchor's href.
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (await copyText(email)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <a
      href={`mailto:${email}`}
      onClick={copy}
      title="Klikk for å kopiere"
      className="inline-flex items-center gap-2 font-mono text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
    >
      {email}
      {copied && (
        <span className="text-xs text-green-600 dark:text-green-400" aria-live="polite">
          kopiert!
        </span>
      )}
    </a>
  )
}
