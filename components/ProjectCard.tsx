'use client'

import { IProject } from '@/types'

interface ProjectCardProps {
  project: IProject
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shadow-md">
      {project.image && (
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-64 object-cover"
          onError={(e) => {
            e.currentTarget.src =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e2e8f0" width="400" height="300"/%3E%3Ctext fill="%2364748b" font-family="sans-serif" font-size="20" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EПроект%3C/text%3E%3C/svg%3E'
          }}
        />
      )}

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
              Демо
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