export default function About() {
  return (
    <section id="about" className="py-16 px-4 md:px-16 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Привет, я Разработчик</h2>
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        Full-stack разработчик с опытом создания современных веб-приложений. Специализируюсь на React, Next.js и TypeScript.
      </p>
      <div className="flex gap-4">
        <a href="#projects" className="px-6 py-2 bg-primary-light dark:bg-primary-dark text-white rounded-lg hover:opacity-90 transition">
          Мои проекты
        </a>
        <a href="#footer" className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition">
          Связаться
        </a>
      </div>
    </section>
  )
}
