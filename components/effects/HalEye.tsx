import type { CSSProperties } from 'react'

// HAL 9000's eye, in the four places it looks out of: the intro, the idle
// screensaver, the 404 and the error page. One drawing; a place picks its
// size and glow by `look` and brings its own spacing and motion (`className`,
// `style`). No 'use client': the 404 renders it on the server, the others in
// the browser.

const DISC =
  'rounded-full bg-[radial-gradient(circle,#ff2020_0%,#cc0000_25%,#800000_45%,#3d0000_65%,#1a0a0a_100%)]'
const CORE =
  'absolute rounded-full bg-[radial-gradient(circle,rgba(255,200,100,0.9)_0%,rgba(255,50,0,0.6)_100%)]'

const LOOKS = {
  // The 404 and the error page: still, a soft glow.
  page: { disc: 'w-16 h-16 md:w-20 md:h-20 shadow-[0_0_50px_10px_rgba(255,0,0,0.2)]', core: 'inset-[34%]' },
  // The idle screensaver: the same eye, brighter against the dark.
  idle: { disc: 'w-16 h-16 md:w-20 md:h-20 shadow-[0_0_60px_15px_rgba(255,0,0,0.25)]', core: 'inset-[34%]' },
  // The intro: smaller, under the monolith.
  intro: {
    disc: 'w-[50px] h-[50px] md:w-[60px] md:h-[60px] shadow-[0_0_50px_15px_rgba(255,0,0,0.25)]',
    core: 'inset-[30%]',
  },
} as const

export default function HalEye({
  look,
  className,
  style,
}: {
  look: keyof typeof LOOKS
  className?: string
  style?: CSSProperties
}) {
  const { disc, core } = LOOKS[look]
  return (
    <div className={className ? `relative ${className}` : 'relative'} style={style} aria-hidden>
      <div className={`${DISC} ${disc}`} />
      <div className={`${CORE} ${core}`} />
    </div>
  )
}
