import { usePathname } from 'next/navigation'
import { langFromPath, type Lang } from './i18n'

// The language of the page being shown, for client components (server
// components get `lang` as a prop from their page instead). Works during the
// static prerender too: usePathname() is the route being exported.
export function useLang(): Lang {
  return langFromPath(usePathname())
}
