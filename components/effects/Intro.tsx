'use client'

import { useState, useEffect, useCallback } from 'react'
import Starfield from './Starfield'
import { makeStars, type Star } from '@/lib/stars'

const SEEN_KEY = 'intro-seen'

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {}
}

function clearPrePaintOverlay() {
  document.documentElement.classList.remove('intro-active')
}

export default function Intro() {
  // Starts inactive so the server-rendered HTML (and any client-side
  // navigation back to the home page) shows nothing. The animation is only
  // triggered, once per session, by the effect below.
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState(0)
  const [stars, setStars] = useState<Star[]>([])

  // Decide on mount whether this is the first visit this session.
  useEffect(() => {
    let seen = false
    try {
      seen = !!sessionStorage.getItem(SEEN_KEY)
    } catch {}

    if (seen) {
      clearPrePaintOverlay()
      return
    }

    // The intro is gated by sessionStorage that's only readable on the
    // client, so the mount-time check is the only honest place to flip
    // state — set-state-in-effect lint is informational here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStars(makeStars(200))
    setActive(true)
  }, [])

  // Run the phase sequence once the overlay is active.
  // 1 = greeting in      2 = greeting out
  // 3 = stars            4 = monolith            5 = HAL eye
  // 6 = HAL+monolith fade out (gives them their own exit animation
  //     instead of disappearing with the overlay)
  // 7 = overlay fade
  useEffect(() => {
    if (!active) return

    // The React overlay (z-100) is now painted over the CSS pre-overlay,
    // so the pre-paint cover can go.
    clearPrePaintOverlay()

    const finish = () => {
      markSeen()
      setActive(false)
    }

    // Greeting fades in over 1600ms, so it needs to hold past ~1750ms before
    // fading out — the later phase-2 gives it room to be seen. The monolith
    // gets a ~1.8s solo (phase 4) before the HAL eye joins (phase 5), then
    // both play their own exit (phase 6) before the overlay fades (phase 7).
    const timers = [
      setTimeout(() => setPhase(1), 150),
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 4000),
      setTimeout(() => setPhase(5), 5800),
      setTimeout(() => setPhase(6), 8000),
      setTimeout(() => setPhase(7), 9800),
      setTimeout(finish, 11200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [active])

  const skip = useCallback(() => {
    markSeen()
    setPhase(7)
    setTimeout(() => setActive(false), 1400)
  }, [])

  // Monolith and HAL split their opacity (quick fade-in so they read
  // immediately) from their transform (slow, cinematic exit), instead of a
  // single transition-all that made the fade-in as sluggish as the exit.
  const monolithTransition = 'opacity 1200ms ease-out, transform 2000ms cubic-bezier(0.22, 1, 0.36, 1)'
  const halTransition = 'opacity 1000ms ease-out, transform 1800ms cubic-bezier(0.22, 1, 0.36, 1)'

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black cursor-pointer select-none overflow-hidden transition-opacity duration-[1400ms] ease-in-out ${phase >= 7 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      onClick={skip}
    >
      {/* Opening greeting card: appears first, fades out before the
          starfield reveal. */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-[1600ms] ease-in-out"
        style={{ opacity: phase === 1 ? 1 : 0 }}
      >
        <p className="font-mono text-sm md:text-base tracking-[0.3em] text-gray-500">
          HEI %USERNAME%
        </p>
      </div>

      {/* Main sequence: stars, monolith, HAL eye */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Starfield stars={stars} lit={phase >= 3} zoom={phase >= 7} />

        {/* Monolith: solos on phase 4, the HAL eye joins on phase 5, on
            phase 6 it tilts away and fades. The slab is a dark gradient
            face with a defined edge and a soft glow so it actually reads
            against the black overlay (pure black-on-black was invisible). */}
        <div
          className="relative z-10"
          style={{
            transition: monolithTransition,
            opacity: phase >= 4 && phase < 6 ? 1 : 0,
            transform: phase >= 6
              ? 'perspective(500px) rotateY(90deg) scale(0.5)'
              : phase >= 4
              ? 'perspective(500px) rotateY(0deg) scale(1)'
              : 'perspective(500px) rotateY(-15deg) scale(0.8)',
          }}
        >
          <div
            className="w-[50px] h-[200px] md:w-[60px] md:h-[240px] bg-black border border-white/10 shadow-[0_0_60px_rgba(255,255,255,0.06)]"
          />
        </div>

        {/* HAL 9000 Eye: pulses out on phase 6 (slight scale up + fade)
            so the eye doesn't just blink off with the overlay. */}
        <div
          className="relative z-10 mt-10"
          style={{
            transition: halTransition,
            opacity: phase >= 5 && phase < 6 ? 1 : 0,
            transform: phase >= 6 ? 'scale(1.25)' : phase >= 5 ? 'scale(1)' : 'scale(0.3)',
          }}
        >
          <div className="w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-full bg-[radial-gradient(circle,#ff2020_0%,#cc0000_25%,#800000_45%,#3d0000_65%,#1a0a0a_100%)] shadow-[0_0_50px_15px_rgba(255,0,0,0.25)]" />
          <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(255,200,100,0.9)_0%,rgba(255,50,0,0.6)_100%)]" />
        </div>
      </div>

      {/* Skip hint */}
      <p
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] tracking-widest text-gray-700 uppercase transition-opacity duration-[1600ms] ease-in-out"
        style={{ opacity: phase >= 1 && phase < 7 ? 1 : 0 }}
      >
        Klikk for å fortsette
      </p>
    </div>
  )
}
