import type { Star } from '@/lib/stars'

// Twinkling star field. `lit` fades the stars in; `zoom` scales the whole
// field out for the intro's warp-out. The `twinkle` keyframes live in
// globals.css.
export default function Starfield({
  stars,
  lit,
  litOpacity = 1,
  zoom = false,
}: {
  stars: Star[]
  lit: boolean
  litOpacity?: number
  zoom?: boolean
}) {
  return (
    <div
      className={`absolute inset-0 transition-transform duration-[2000ms] ease-in ${zoom ? 'scale-[20]' : 'scale-100'}`}
    >
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: lit ? litOpacity : 0,
            animation: lit ? `twinkle ${star.duration}s ${star.delay}s ease-in-out infinite` : 'none',
            transition: 'opacity 1.5s ease-in',
          }}
        />
      ))}
    </div>
  )
}
