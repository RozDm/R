'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// The footer's © year. The export is built once and served for months, so a
// year baked in at build went stale on 1 January until the next deploy: the
// static HTML keeps the build's year, the browser shows the current one.
export default function CopyrightYear({ built }: { built: number }) {
  return useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => built,
  )
}
