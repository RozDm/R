import { useEffect, useState, type RefObject } from 'react'

// True once the element comes within `margin` of the viewport, and true from
// then on. The front page's widgets below the fold (status, map, chart, the
// footer's status dot) mount and fetch only then: each /api/* call is a Worker
// request against the free plan's daily quota, and a visitor who never
// scrolls down never needed the map's SVG or the flag font either. A /#status
// link lands with the section in view, so it loads at once.
export function useNearViewport(ref: RefObject<Element | null>, margin = '600px'): boolean {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: `${margin} 0px` },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, near, margin])
  return near
}
