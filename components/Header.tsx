'use client'

import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="w-full py-6 px-4 md:px-16 flex items-center justify-between bg-white dark:bg-gray-900 shadow-md sticky top-0 z-50">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Портфолио</h1>
      <nav className="flex items-center space-x-6">
        <a href="#about" className="text-gray-700 dark:text-gray-300 hover:text-primary-light dark:hover:text-primary-dark">
          О себе
        </a>
        <a href="#skills" className="text-gray-700 dark:text-gray-300 hover:text-primary-light dark:hover:text-primary-dark">
          Навыки
        </a>
        <a href="#projects" className="text-gray-700 dark:text-gray-300 hover:text-primary-light dark:hover:text-primary-dark">
          Проекты
        </a>
        <ThemeToggle />
      </nav>
    </header>
  )
}