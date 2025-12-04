import { projects } from '@/data/projects'
import ProjectCard from './ProjectCard'

export default function Projects() {
  return (
    <section id="projects" className="py-16 px-4 md:px-16 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h2 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Проекты</h2>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
