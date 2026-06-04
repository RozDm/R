export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      id="footer"
      className="w-full py-10 px-4 md:px-16 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Kontakt meg</h2>
        <div className="flex gap-6">
          <a
            href="mailto:d.rossoshnyh@gmail.com"
            className="hover:text-primary-light dark:hover:text-primary-dark transition"
          >
            E-post
          </a>
          <a
            href="https://github.com/RozDm"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-light dark:hover:text-primary-dark transition"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary-light dark:hover:text-primary-dark transition"
          >
            LinkedIn
          </a>
        </div>
        <p className="text-sm">&copy; {currentYear} Dmytro Rozsoshnykh. Alle rettigheter forbeholdt.</p>
      </div>
    </footer>
  )
}
