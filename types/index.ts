export interface Project {
  id: number
  title: string
  description: string
  techStack: string[]
  link?: string
  github?: string
  year?: number
}

export interface Skill {
  id: number
  name: string
  level: 1 | 2 | 3 | 4 | 5
  category: 'Frontend' | 'Backend' | 'Verktøy'
}
