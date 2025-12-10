'use client'

import { useState } from 'react'
import { ISkill } from '@/types'

const skills: ISkill[] = [
  { id: 1, name: 'React', level: 5, category: 'Frontend' },
  { id: 2, name: 'Next.js', level: 5, category: 'Frontend' },
  { id: 3, name: 'TypeScript', level: 4, category: 'Frontend' },
  { id: 4, name: 'Tailwind CSS', level: 5, category: 'Frontend' },
  { id: 5, name: 'Node.js', level: 4, category: 'Backend' },
  { id: 6, name: 'PostgreSQL', level: 3, category: 'Backend' },
  { id: 7, name: 'MongoDB', level: 4, category: 'Backend' },
  { id: 8, name: 'Git', level: 5, category: 'Tools' },
  { id: 9, name: 'Docker', level: 3, category: 'Tools' },
  { id: 10, name: 'Figma', level: 4, category: 'Tools' },
]

type Category = 'Frontend' | 'Backend' | 'Tools'

export default function Skills() {
  const [activeCategory, setActiveCategory] = useState<Category>('Frontend')
  const categories: Category[] = ['Frontend', 'Backend', 'Tools']
  const filteredSkills = skills.filter(skill => skill.category === activeCategory)

  return (
    <section id="skills" className="py-16 px-4 md:px-16 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Kompetanse</h2>

      <div className="flex gap-4 mb-6">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-6 py-2 rounded-lg transition-colors ${
              activeCategory === category
                ? 'bg-primary-light dark:bg-primary-dark text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredSkills.map(skill => (
          <div key={skill.id} className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow">
            <div className="flex justify-between mb-1 text-gray-900 dark:text-white font-semibold">
              <span>{skill.name}</span>
              <span>{skill.level}/5</span>
            </div>
            <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-2 bg-primary-light dark:bg-primary-dark transition-all duration-500"
                style={{ width: `${(skill.level / 5) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
