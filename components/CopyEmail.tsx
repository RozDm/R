'use client'

import { useState } from 'react'

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// Click copies the address to the clipboard (mailto handlers are unreliable
// on desktops without a default mail app). Right-click still exposes the
// mailto via the wrapping anchor's href.
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault()
    let ok = false
    try {
      await navigator.clipboard.writeText(email)
      ok = true
    } catch {
      ok = legacyCopy(email)
    }
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <a
      href={`mailto:${email}`}
      onClick={copy}
      className="inline-flex items-center gap-2 font-mono text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
    >
      {email}
      <span className="text-xs text-gray-400 dark:text-gray-500" aria-live="polite">
        {copied ? '— kopiert!' : '— klikk for å kopiere'}
      </span>
    </a>
  )
}
