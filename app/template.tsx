'use client'

import { usePathname } from 'next/navigation'

// A template (unlike a layout) re-mounts on every navigation, so the
// .animate-page-in fade replays on each route change — pages cross-fade in
// instead of snapping.
//
// The home route opts out: its cinematic intro (z-100 fixed overlay + a
// black pre-paint cover) owns the first-load entrance, and wrapping it in an
// opacity layer would create a stacking context that fights those overlays.
// On the home route we render a plain pass-through wrapper (no opacity, no
// transform) so fixed/sticky positioning is byte-for-byte unchanged.
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const animate = !!pathname && pathname !== '/'
  return <div className={animate ? 'animate-page-in' : undefined}>{children}</div>
}
