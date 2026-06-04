'use client'

import { useState } from 'react'
import { skills } from '@/data/skills'

type Category = 'Frontend' | 'Backend' | 'Verktøy'

const categories: Category[] = ['Frontend', 'Backend', 'Verktøy']

export default function Skills() {
  const [activeCategory, setActiveCategory] = useState<Category>('Frontend')
  const filtered = skills.filter(s => s.category === activeCategory)

  return (
    <section id="skills" className="flex flex-col gap-6 animate-fade-in">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Kompetanse</h2>

      <div className="flex gap-2" role="tablist" aria-label="Kompetansekategorier">
        {categories.map(cat => (
          <button
            key={cat}
            role="tab"
            aria-selected={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-primary-light dark:bg-primary-dark text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="tabpanel">
        {filtered.map(skill => (
          <div key={skill.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex justify-between mb-2 text-gray-900 dark:text-white font-medium text-sm">
              <span>{skill.name}</span>
              <span className="text-gray-500 dark:text-gray-400">{skill.level}/5</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-light dark:bg-primary-dark rounded-full transition-all duration-500"
                style={{ width: `${(skill.level / 5) * 100}%` }}
                role="progressbar"
                aria-valuenow={skill.level}
                aria-valuemin={1}
                aria-valuemax={5}
                aria-label={`${skill.name}: ${skill.level} av 5`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
