'use client'

import { useState } from 'react'
import { copyText } from '@/lib/clipboard'
import { DICT } from '@/data/i18n'
import { useLang } from '@/lib/use-lang'

// On a desktop a click copies the address (mailto handlers are unreliable
// there without a default mail app; right-click still offers the mailto). On
// a touch screen the tap opens the mail app, as people expect of an address.
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  const t = DICT[useLang()].footer

  const copy = async (e: React.MouseEvent) => {
    if (matchMedia('(pointer: coarse)').matches) return
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
      title={t.copyHint}
      className="inline-flex items-center gap-2 font-mono text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
    >
      {email}
      {copied && (
        <span aria-hidden className="text-xs text-green-700 dark:text-green-400">
          {t.copied}
        </span>
      )}
      {/* Always mounted: a live region that appears together with its text
          is often not announced at all. sr-only is absolutely positioned, so
          it takes no flex gap. */}
      <span className="sr-only" aria-live="polite">
        {copied ? t.copied : ''}
      </span>
    </a>
  )
}
