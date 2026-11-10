import Link from 'next/link'
import HashLink from './HashLink'
import StatusDot from './StatusDot'
import CopyEmail from './CopyEmail'
import CopyrightYear from './CopyrightYear'
import Eyebrow from './Eyebrow'
import { DICT } from '@/data/i18n'
import { localePath, type Lang } from '@/lib/i18n'
import { CONTACT_ADDRESS } from '@/src/contact'

// py/-my: a 44px-tall tap target on a 20px line, without moving anything. The
// footer is a phone's last stop, and its links were 20px (the privacy one
// 16px) tall. CopyEmail matches it.
const LINK =
  'py-3 -my-3 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out'

// `invite={false}` on the contact page: «La oss snakkes» and the link to
// the form would invite the visitor to the page they are already on.
export default function Footer({ lang = 'nb', invite = true }: { lang?: Lang; invite?: boolean }) {
  const t = DICT[lang].footer
  return (
    <footer
      id="footer"
      className="w-full mt-20 border-t border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 flex flex-col items-center gap-6 text-center">
        {invite && (
          <>
            <Eyebrow className="">{t.eyebrow}</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              {t.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              {t.lead}
            </p>
          </>
        )}

        <div className="flex gap-8 text-sm font-medium pt-2">
          {invite && (
            <Link
              href={localePath(lang, '/kontakt/')}
              prefetch={false}
              className={LINK}
            >
              {t.form}
            </Link>
          )}
          <a
            href="https://github.com/RozDm"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/dmytro-rozsoshnykh/"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            LinkedIn
          </a>
        </div>

        <CopyEmail email={CONTACT_ADDRESS} />

        <HashLink
          href={localePath(lang, '/#status')}
          className="inline-flex items-center gap-2 py-3 -mt-1 -mb-3 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
        >
          <StatusDot />
          {t.status}
        </HashLink>

        <p className="text-xs text-gray-500 dark:text-gray-400 pt-8 font-mono">
          &copy; <CopyrightYear built={new Date().getFullYear()} /> Dmytro Rozsoshnykh
          {' · '}
          <Link
            href={localePath(lang, '/personvern/')}
            prefetch={false}
            className="py-3 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 ease-out"
          >
            {t.privacy}
          </Link>
        </p>
      </div>
    </footer>
  )
}
