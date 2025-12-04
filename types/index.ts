export interface IProject {
  id: number
  title: string
  description: string
  techStack: string[]
  image?: string
  link?: string
  github?: string
  year?: number
}

export interface ISkill {
  id: number
  name: string
  level: 1 | 2 | 3 | 4 | 5
  category: 'Frontend' | 'Backend' | 'Tools' | 'Other'
}