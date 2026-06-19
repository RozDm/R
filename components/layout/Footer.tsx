import Link from 'next/link'
import HashLink from './HashLink'
import StatusDot from './StatusDot'
import CopyEmail from './CopyEmail'

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

        <div className="flex gap-8 text-sm font-medium pt-2">
          <Link
            href="/kontakt/"
            className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            Kontaktskjema
          </Link>
          <a
            href="https://github.com/RozDm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/dmytro-rozsoshnykh/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            LinkedIn
          </a>
        </div>

        <CopyEmail email="contact@rozsoshnykh.no" />

        <HashLink
          href="/#status"
          className="inline-flex items-center gap-2 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 ease-out pt-2"
        >
          <StatusDot />
          Driftsstatus
        </HashLink>

        <p className="text-xs text-gray-400 dark:text-gray-600 pt-8 font-mono">
          &copy; {currentYear} Dmytro Rozsoshnykh
        </p>
      </div>
    </footer>
  )
}
