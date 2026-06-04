export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      id="footer"
      className="w-full mt-20 border-t border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 flex flex-col items-center gap-6 text-center">
        <p className="text-red-500 dark:text-red-400 font-mono text-sm tracking-widest uppercase">
          Kontakt
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          La oss snakkes
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          Interessert i samarbeid eller har et spørsmål? Ta gjerne kontakt.
        </p>

        {/* TODO: erstatt med ekte kontaktinfo */}
        <div className="flex flex-col items-center gap-1 font-mono text-sm text-gray-500 dark:text-gray-400 pt-2">
          <span>E-post: din@epost.no</span>
          <span>Telefon: +47 000 00 000</span>
          <span>Adresse: Vestland, Norge</span>
        </div>

        <div className="flex gap-8 text-sm font-medium pt-2">
          <a
            href="#"
            className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            GitHub
          </a>
          <a
            href="#"
            className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            LinkedIn
          </a>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 pt-8 font-mono">
          &copy; {currentYear} Dmytro Rozsoshnykh
        </p>
      </div>
    </footer>
  )
}
