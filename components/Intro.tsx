'use client'

import { useState, useEffect, useCallback } from 'react'

interface Star {
  x: number
  y: number
  size: number
  delay: number
  duration: number
}

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

    setStars(
      Array.from({ length: 200 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        delay: Math.random() * 2,
        duration: Math.random() * 3 + 2,
      })),
    )
    setActive(true)
  }, [])

  // Run the phase sequence once the overlay is active.
  useEffect(() => {
    if (!active) return

    // The React overlay (z-100) is now painted over the CSS pre-overlay,
    // so the pre-paint cover can go.
    clearPrePaintOverlay()

    const finish = () => {
      markSeen()
      setActive(false)
    }

    // Total ~3.8s: branded interstitials past ~3s sharply raise bounce risk,
    // and the "2001" nod lands within the first couple of seconds anyway.
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1700),
      setTimeout(() => setPhase(4), 2500),
      setTimeout(() => setPhase(5), 3200),
      setTimeout(finish, 3800),
    ]
    return () => timers.forEach(clearTimeout)
  }, [active])

  const skip = useCallback(() => {
    markSeen()
    setPhase(5)
    setTimeout(() => setActive(false), 600)
  }, [])

  if (!active) return null

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden transition-opacity duration-700 ${phase >= 5 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      onClick={skip}
    >
      {/* Starfield */}
      <div className={`absolute inset-0 transition-transform duration-[2000ms] ease-in ${phase >= 5 ? 'scale-[20]' : 'scale-100'}`}>
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: phase >= 1 ? 1 : 0,
              animation: phase >= 1 ? `twinkle ${star.duration}s ${star.delay}s ease-in-out infinite` : 'none',
              transition: 'opacity 1.5s ease-in',
            }}
          />
        ))}
      </div>

      {/* Monolith */}
      <div
        className="relative z-10 transition-all duration-[1500ms]"
        style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2
            ? phase >= 5 ? 'perspective(500px) rotateY(90deg) scale(0.5)' : 'perspective(500px) rotateY(0deg) scale(1)'
            : 'perspective(500px) rotateY(-15deg) scale(0.8)',
        }}
      >
        <div className="w-[50px] h-[200px] md:w-[60px] md:h-[240px] bg-black border border-white/[0.06] shadow-[0_0_80px_rgba(255,255,255,0.04)]" />
      </div>

      {/* HAL 9000 Eye */}
      <div
        className="relative z-10 mt-10 transition-all duration-1000"
        style={{
          opacity: phase >= 3 ? 1 : 0,
          transform: phase >= 3 ? 'scale(1)' : 'scale(0.3)',
        }}
      >
        <div className="w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-full bg-[radial-gradient(circle,#ff2020_0%,#cc0000_25%,#800000_45%,#3d0000_65%,#1a0a0a_100%)] shadow-[0_0_50px_15px_rgba(255,0,0,0.25)]" />
        <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(255,200,100,0.9)_0%,rgba(255,50,0,0.6)_100%)]" />
      </div>

      {/* Terminal text */}
      <div
        className="relative z-10 mt-10 transition-all duration-1000"
        style={{
          opacity: phase >= 4 ? 1 : 0,
          transform: phase >= 4 ? 'translateY(0)' : 'translateY(10px)',
        }}
      >
        <p className="font-mono text-sm md:text-base tracking-[0.3em] text-gray-500">
          HEI %USERNAME%
        </p>
      </div>

      {/* Skip hint */}
      <p
        className="absolute bottom-8 text-[11px] tracking-widest text-gray-700 uppercase transition-opacity duration-1000"
        style={{ opacity: phase >= 1 && phase < 5 ? 1 : 0 }}
      >
        Klikk for å fortsette
      </p>
    </div>
  )
}
