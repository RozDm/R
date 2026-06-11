'use client'

import { useEffect, useState } from 'react'

// After IDLE_MS without any user activity on the front page, HAL wakes up:
// static noise, the eye, and the inevitable question. Any activity dismisses
// it. Shows at most once per browser session, never with reduced motion.
const IDLE_MS = 75_000
const SEEN_KEY = 'hal-idle-seen'

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'pointermove',
  'pointerdown',
  'keydown',
  'scroll',
  'touchstart',
]

export default function HalIdle() {
  const [active, setActive] = useState(false)
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState(0)

  // Arm the idle timer; any activity re-arms it.
  useEffect(() => {
    if (active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return
    } catch {}

    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (document.hidden) {
          arm()
          return
        }
        try {
          sessionStorage.setItem(SEEN_KEY, '1')
        } catch {}
        setActive(true)
      }, IDLE_MS)
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, arm))
    }
  }, [active])

  // Phase sequence + dismissal once awake. The overlay fades in over ~900ms
  // and fades back out before unmounting; a short grace period stops the
  // very first mouse twitch from killing it before it's visible.
  useEffect(() => {
    if (!active) return
    const fadeIn = requestAnimationFrame(() => setVisible(true))
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1300),
      setTimeout(() => setPhase(3), 2400),
      setTimeout(() => setPhase(4), 4000),
    ]
    let unmount: ReturnType<typeof setTimeout> | undefined
    const dismiss = () => {
      setVisible(false)
      unmount = setTimeout(() => {
        setActive(false)
        setPhase(0)
      }, 950)
    }
    const grace = setTimeout(() => {
      ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, dismiss, { passive: true, once: true }))
    }, 1000)
    return () => {
      cancelAnimationFrame(fadeIn)
      timers.forEach(clearTimeout)
      clearTimeout(grace)
      clearTimeout(unmount)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, dismiss))
    }
  }, [active])

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-[95] bg-black overflow-hidden cursor-pointer select-none transition-opacity duration-[900ms] ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="presentation"
      aria-hidden
    >
      {/* CRT scanlines + flicker */}
      <div className="absolute inset-0 hal-scanlines" />
      <div className="absolute inset-0 hal-flicker bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.85)_100%)]" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-12">
        {/* HAL eye */}
        <div
          className="relative hal-jitter transition-opacity duration-1000"
          style={{ opacity: phase >= 2 ? 1 : 0 }}
        >
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[radial-gradient(circle,#ff2020_0%,#cc0000_25%,#800000_45%,#3d0000_65%,#1a0a0a_100%)] shadow-[0_0_60px_15px_rgba(255,0,0,0.25)]" />
          <div className="absolute inset-[34%] rounded-full bg-[radial-gradient(circle,rgba(255,200,100,0.9)_0%,rgba(255,50,0,0.6)_100%)]" />
        </div>

        {/* The question */}
        <p
          className="hal-jitter font-mono text-sm md:text-base tracking-[0.3em] text-red-500/90 h-6 transition-opacity duration-700"
          style={{ opacity: phase >= 3 ? 1 : 0 }}
        >
          {phase >= 4 ? 'HVA GJØR DU, %USERNAME%?' : '%USERNAME%?'}
        </p>

        <p className="absolute bottom-8 text-[11px] tracking-widest text-gray-700 uppercase">
          Beveg musen for å fortsette
        </p>
      </div>
    </div>
  )
}
