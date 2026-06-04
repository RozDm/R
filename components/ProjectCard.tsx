import { Project } from '@/types'

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="group p-6 bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-red-500/30 dark:hover:border-red-500/20 transition-all duration-500 hover:shadow-lg dark:hover:shadow-red-500/5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors duration-300">
          {project.title}
        </h3>
        {project.year && (
          <span className="text-xs font-mono text-gray-400 dark:text-gray-600">{project.year}</span>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {project.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {project.techStack.map((tech) => (
          <span
            key={tech}
            className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-mono"
          >
            {tech}
          </span>
        ))}
      </div>

      <div className="mt-5 flex gap-4 text-sm font-medium">
        {project.link && (
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            Demo &rarr;
          </a>
        )}
        {project.github && (
          <a
            href={project.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-gray-400 hover:underline"
          >
            Kode &rarr;
          </a>
        )}
      </div>
    </div>
  )
}
