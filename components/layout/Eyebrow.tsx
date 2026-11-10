import type { ReactNode } from 'react'

// The mono, uppercase, red line above a heading: every section and page
// header starts with one (components/CLAUDE.md, UI conventions). `className`
// is its distance to the heading — mb-2 unless a page says otherwise: the 404
// and the error page stand further off, the footer spaces its own column.
const EYEBROW = 'text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase'

export default function Eyebrow({ children, className = 'mb-2' }: { children: ReactNode; className?: string }) {
  return <p className={className ? `${EYEBROW} ${className}` : EYEBROW}>{children}</p>
}
