'use client'

import { useState, useEffect, useRef } from 'react'

interface MobileMenuProps {
  links: { href: string; label: string }[]
}

export default function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative z-10 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label={open ? 'Lukk meny' : 'Åpne meny'}
        aria-expanded={open}
      >
        <div className="flex flex-col justify-center items-center w-5 h-5 gap-[5px]">
          <span className={`block w-5 h-[2px] bg-gray-700 dark:bg-gray-300 rounded-full transition-all duration-300 ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
          <span className={`block w-5 h-[2px] bg-gray-700 dark:bg-gray-300 rounded-full transition-all duration-300 ${open ? 'opacity-0 scale-0' : ''}`} />
          <span className={`block w-5 h-[2px] bg-gray-700 dark:bg-gray-300 rounded-full transition-all duration-300 ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
        </div>
      </button>

      {open && (
        <nav
          className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden animate-fade-in"
          aria-label="Mobilnavigasjon"
        >
          {links.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block px-5 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              {label}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
