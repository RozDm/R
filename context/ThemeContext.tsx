'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { THEME_BG } from '@/lib/site'

type Theme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function osTheme(): Theme {
  return matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

// localStorage 'theme' holds a hand-picked theme; none means "follow the OS"
// (the <head> script in app/layout.tsx reads the same key before paint).
function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

// The <meta name="theme-color"> pair (app/layout.tsx viewport) follows the OS
// scheme via media queries. Once the visitor picks a theme by hand, point both
// at that theme's background so the mobile browser bar matches the page;
// `null` (following the OS again) gives each its own scheme's colour back.
function syncThemeColor(theme: Theme | null) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const own: Theme = m.getAttribute('media')?.includes('dark') ? 'dark' : 'light'
    m.setAttribute('content', THEME_BG[theme ?? own])
  })
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
    if (storedTheme()) syncThemeColor(initial)

    // Following the OS (nothing picked by hand): follow it live too, e.g. an
    // automatic light/dark switch at sunset while the page is open.
    const media = matchMedia(DARK_QUERY)
    const onOsChange = () => {
      if (storedTheme()) return
      const next = osTheme()
      applyTheme(next)
      setThemeState(next)
    }
    media.addEventListener('change', onOsChange)
    return () => media.removeEventListener('change', onOsChange)
  }, [])

  // Every click flips the theme. A pick that matches the OS is not stored:
  // flipping back to the OS's own theme is the way back to "follow the
  // system", without a third button state.
  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      applyTheme(next)
      const followOs = next === osTheme()
      try {
        if (followOs) localStorage.removeItem('theme')
        else localStorage.setItem('theme', next)
      } catch {}
      syncThemeColor(followOs ? null : next)
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
