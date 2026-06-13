export interface Star {
  x: number
  y: number
  size: number
  delay: number
  duration: number
}

// Random field used by both the intro and the HAL idle screensaver.
export function makeStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
  }))
}
