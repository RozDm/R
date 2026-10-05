import Link from 'next/link'
import HashLink from './HashLink'
import StatusDot from './StatusDot'
import CopyEmail from './CopyEmail'
import { DICT } from '@/data/i18n'
import { localePath, type Lang } from '@/lib/i18n'

export default function Footer({ lang = 'nb' }: { lang?: Lang }) {
  const t = DICT[lang].footer
  const currentYear = new Date().getFullYear()

  return (
    <footer
      id="footer"
      className="w-full mt-20 border-t border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 flex flex-col items-center gap-6 text-center">
        <p className="text-red-600 dark:text-red-400 font-mono text-sm tracking-widest uppercase">
          {t.eyebrow}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
          {t.title}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          {t.lead}
        </p>

        <div className="flex gap-8 text-sm font-medium pt-2">
          <Link
            href={localePath(lang, '/kontakt/')}
            className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            {t.form}
          </Link>
          <a
            href="https://github.com/RozDm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/dmytro-rozsoshnykh/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            LinkedIn
          </a>
        </div>

        <CopyEmail email="contact@rozsoshnykh.no" />

        <HashLink
          href={localePath(lang, '/#status')}
          className="inline-flex items-center gap-2 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out pt-2"
        >
          <StatusDot />
          {t.status}
        </HashLink>

        <p className="text-xs text-gray-500 dark:text-gray-400 pt-8 font-mono">
          &copy; {currentYear} Dmytro Rozsoshnykh
          {' · '}
          <Link
            href={localePath(lang, '/personvern/')}
            className="hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            {t.privacy}
          </Link>
        </p>
      </div>
    </footer>
  )
}
