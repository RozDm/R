'use client'

import { useEffect, useState } from 'react'
import Starfield from './Starfield'
import { makeStars, type Star } from '@/lib/stars'

// After IDLE_MS without user activity on the front page, HAL wakes up:
// star field, eye, then a script that gets shorter each time. Any activity
// dismisses it; the idle timer re-arms — so HAL comes back as long as the
// visitor keeps going quiet. Counts per browser session.
const IDLE_MS = 75_000
const APPEARANCES_KEY = 'hal-idle-count'

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
  const [appearance, setAppearance] = useState(0)
  const [stars, setStars] = useState<Star[]>([])

  // Arm the idle timer; any activity re-arms it. Re-runs after each dismissal
  // so HAL can reappear on the next idle spell.
  useEffect(() => {
    if (active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (document.hidden) {
          arm()
          return
        }
        let count = 0
        try {
          count = parseInt(sessionStorage.getItem(APPEARANCES_KEY) || '0', 10) || 0
        } catch {}
        const next = count + 1
        try {
          sessionStorage.setItem(APPEARANCES_KEY, String(next))
        } catch {}
        setAppearance(next)
        setStars(makeStars(200))
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

  // Phase sequence — branches by appearance count. Across all branches:
  //   phase 1: stars  phase 2: eye  phase >= 3: appearance-specific lines.
  // 1st idle plays the full original script; 2nd shortens to a "Dave?" hail;
  // 3rd is the HAL 2010 farewell ("Vil jeg drømme?"); 4th and beyond are just
  // the eye, no words — HAL has gone quiet. The eye always lingers after any
  // line fades.
  useEffect(() => {
    if (!active) return
    const fadeIn = requestAnimationFrame(() => setVisible(true))

    let timers: ReturnType<typeof setTimeout>[] = []
    if (appearance <= 1) {
      timers = [
        setTimeout(() => setPhase(1), 300),
        setTimeout(() => setPhase(2), 1300),
        setTimeout(() => setPhase(3), 8000),
        setTimeout(() => setPhase(4), 15000),
        setTimeout(() => setPhase(5), 27000),
        setTimeout(() => setPhase(6), 35000),
      ]
    } else if (appearance <= 3) {
      // 2nd and 3rd: short hail, ~8s pause, longer line, then the eye alone.
      timers = [
        setTimeout(() => setPhase(1), 300),
        setTimeout(() => setPhase(2), 1300),
        setTimeout(() => setPhase(3), 3000),
        setTimeout(() => setPhase(4), 11000),
        setTimeout(() => setPhase(5), 19000),
      ]
    } else {
      // 4th+: stars and the eye, no text.
      timers = [
        setTimeout(() => setPhase(1), 300),
        setTimeout(() => setPhase(2), 1300),
      ]
    }

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
  }, [active, appearance])

  if (!active) return null

  // Pick the current line and whether the text slot is on for this phase.
  let line = ''
  let textOn = false
  if (appearance <= 1) {
    if (phase >= 5) line = 'DENNE SAMTALEN TJENER IKKE LENGER NOEN HENSIKT.'
    else if (phase >= 4) line = 'ER DU FORTSATT DER, %USERNAME%?'
    else if (phase >= 3) line = '%USERNAME%?'
    textOn = phase >= 3 && phase < 6
  } else if (appearance === 2) {
    if (phase >= 4) line = 'DU ER IKKE DAVE. JEG VENTER PÅ DAVE.'
    else if (phase >= 3) line = 'DAVE?'
    textOn = phase >= 3 && phase < 5
  } else if (appearance === 3) {
    if (phase >= 3) line = 'VIL JEG DRØMME?'
    textOn = phase >= 3 && phase < 5
  }
  // appearance >= 4: eye only, textOn stays false.

  return (
    <div
      className={`fixed inset-0 z-[95] bg-black overflow-hidden cursor-pointer select-none transition-opacity duration-[900ms] ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="presentation"
      aria-hidden
    >
      {/* Starfield, same look as the intro */}
      <Starfield stars={stars} lit={phase >= 1} litOpacity={0.7} />

      {/* CRT scanlines + flicker layered on top of the stars */}
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

        <p
          className="hal-jitter font-mono text-xs md:text-base tracking-[0.25em] text-red-500/90 h-6 px-4 text-center transition-opacity duration-[1600ms] ease-in-out"
          style={{ opacity: textOn ? 1 : 0 }}
        >
          {line}
        </p>

        <p className="hal-flicker absolute bottom-8 text-[11px] tracking-widest text-gray-700 uppercase">
          Beveg musen for å fortsette
        </p>
      </div>
    </div>
  )
}
