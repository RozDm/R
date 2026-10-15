'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// A template (unlike a layout) re-mounts on every navigation, so the
// .animate-page-in fade replays on each route change — pages cross-fade in
// instead of snapping.
//
// The home routes opt out: its cinematic intro (z-100 fixed overlay + a
// black pre-paint cover) owns the first-load entrance, and wrapping it in an
// opacity layer would create a stacking context that fights those overlays.
// On the home route we render a plain pass-through wrapper (no opacity, no
// transform) so fixed/sticky positioning is byte-for-byte unchanged.
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Both front pages (/ and /en/) host the intro overlay and opt out.
  const animate = !!pathname && pathname !== '/' && pathname !== '/en' && pathname !== '/en/'
  // Keyed by pathname: Next re-mounts a root template only when the top-level
  // segment changes, so /blogg/ → /blogg/<slug>/ would otherwise skip the fade.
  return (
    <PageFade key={pathname} animate={animate}>
      {children}
    </PageFade>
  )
}

// Set once the document's first page has hydrated; every page mounted after
// that arrived by a client-side navigation.
let hydrated = false

// Fades in only on client-side navigations. The document's first page (a post
// opened from search or a shared link) renders without the class, in the
// static HTML too — a full load must paint at once, not sit at opacity 0 for
// 450ms (which also hid it from LCP).
function PageFade({ animate, children }: { animate: boolean; children: React.ReactNode }) {
  const [navigated] = useState(() => hydrated)
  useEffect(() => {
    hydrated = true
  }, [])
  return <div className={animate && navigated ? 'animate-page-in' : undefined}>{children}</div>
}
