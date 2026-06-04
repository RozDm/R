import { IProject } from '@/types'

interface ProjectCardProps {
  project: IProject
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shadow-md">
      <div className="p-4">
        <h3 className="text-xl font-bold">
          {project.title} {project.year && <span className="text-sm text-gray-500">({project.year})</span>}
        </h3>
        <p className="mt-2 text-gray-700 dark:text-gray-300">{project.description}</p>

        <div className="mt-2 flex flex-wrap gap-2">
          {project.techStack.map((tech) => (
            <span
              key={tech}
              className="bg-primary-light dark:bg-primary-dark text-white px-2 py-1 rounded-full text-sm"
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="mt-3 flex gap-4">
          {project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline"
            >
              Demo
            </a>
          )}
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-800 dark:text-gray-200 underline"
            >
              GitHub
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
