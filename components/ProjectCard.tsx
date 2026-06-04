import { Project } from '@/types'

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="group p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50 hover:border-primary-light/50 dark:hover:border-primary-dark/50 transition-all duration-300">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        {project.title}
        {project.year && (
          <span className="ml-2 text-xs font-normal text-gray-400">{project.year}</span>
        )}
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {project.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.techStack.map((tech) => (
          <span
            key={tech}
            className="text-xs px-2.5 py-1 rounded-full bg-primary-light/10 dark:bg-primary-dark/10 text-primary-light dark:text-primary-dark font-medium"
          >
            {tech}
          </span>
        ))}
      </div>

      <div className="mt-4 flex gap-4 text-sm">
        {project.link && (
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-light dark:text-primary-dark hover:underline font-medium"
          >
            Demo
          </a>
        )}
        {project.github && (
          <a
            href={project.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-gray-400 hover:underline font-medium"
          >
            GitHub
          </a>
        )}
      </div>
    </div>
  )
}
