'use client'

import dynamic from 'next/dynamic'

// HAL's idle screensaver renders nothing until 75s of inactivity on the front
// page, so there's no reason to ship its ~190 lines in the initial home bundle.
// Load it lazily (ssr:false, no loading fallback — it renders null until it
// wakes) so the code stays off the critical path. The idle timer simply arms
// on the dynamic chunk's mount, a beat after hydration — immaterial against a
// 75s threshold. Intro stays eager: it owns the first paint of the first visit.
const HalIdle = dynamic(() => import('./HalIdle'), { ssr: false })

export default function LazyHalIdle() {
  return <HalIdle />
}
