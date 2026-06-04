import { projects } from '@/data/projects'
import ProjectCard from './ProjectCard'

export default function Projects() {
  return (
    <section id="projects" className="flex flex-col gap-6 animate-fade-in">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Prosjekter</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
