'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { THEME_BG } from '@/lib/site'

type Theme = 'light' | 'dark'

// The <meta name="theme-color"> pair (app/layout.tsx viewport) follows the OS
// scheme via media queries. Once the visitor picks a theme by hand, point both
// at that theme's background so the mobile browser bar matches the page.
function syncThemeColor(theme: Theme) {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', THEME_BG[theme]))
}

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from a constant so the server render and the first client render
  // are identical (prevents React hydration error #418). The real theme is
  // already applied to <html> by the inline script in <head> before paint;
  // we sync React state to it right after mount.
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Classic post-hydration sync: the inline <head> script set the dark
    // class before paint; we read the truth back into React state once we
    // know we're in the browser. set-state-in-effect is the right pattern
    // here — there's no alternative way to learn the initial value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const initial: Theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    setThemeState(initial)
    try {
      if (localStorage.getItem('theme')) syncThemeColor(initial)
    } catch {}
  }, [])

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      syncThemeColor(next)
      try {
        localStorage.setItem('theme', next)
      } catch {}
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
