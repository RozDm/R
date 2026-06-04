export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      id="footer"
      className="w-full mt-20 border-t border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-12 flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kontakt meg</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          Interessert i samarbeid eller har et spørsmål? Ta gjerne kontakt.
        </p>
        <div className="flex gap-6 text-sm font-medium">
          <a
            href="mailto:d.rossoshnyh@gmail.com"
            className="text-gray-600 dark:text-gray-400 hover:text-primary-light dark:hover:text-primary-dark transition-colors"
          >
            E-post
          </a>
          <a
            href="https://github.com/RozDm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-gray-400 hover:text-primary-light dark:hover:text-primary-dark transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/dmytro-rozsoshnykh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-gray-400 hover:text-primary-light dark:hover:text-primary-dark transition-colors"
          >
            LinkedIn
          </a>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          &copy; {currentYear} Dmytro Rozsoshnykh
        </p>
      </div>
    </footer>
  )
}
