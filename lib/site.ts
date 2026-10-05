// Sentral konfigurasjon for nettstedet (brukt i metadata, sitemap og JSON-LD)
import type { Lang } from './i18n'

export const SITE_URL = 'https://rozsoshnykh.no'
export const SITE_HOST = 'rozsoshnykh.no'

export const AUTHOR = {
  name: 'Dmytro Rozsoshnykh',
  // One positioning for every surface — hero eyebrow, OG images, meta
  // descriptions, JSON-LD, manifest. They used to drift apart (Utvikler on the
  // hero, IT-driftstekniker in the meta description, DevOps-ingeniør in
  // JSON-LD); change it here, never in a component.
  roles: ['Systemadministrator', 'DevOps', 'Utvikler'],
  jobTitle: 'Systemadministrator / DevOps',
  location: 'Askøy, Vestland, Norge',
  sameAs: [
    'https://github.com/RozDm',
    'https://www.linkedin.com/in/dmytro-rozsoshnykh/',
  ],
}

// The same positioning per language (the /en/ pages, their OG card and
// metadata). Norwegian stays the canonical copy; the constants below alias it.
const ROLES_EN = ['Systems Administrator', 'DevOps', 'Developer']

export const SITE_COPY: Record<
  Lang,
  { roles: string[]; title: string; description: string; tagline: string; focus: string }
> = {
  nb: {
    roles: AUTHOR.roles,
    title: `${AUTHOR.name} – Systemadministrator & DevOps i Vestland`,
    description:
      'Systemadministrator, DevOps og utvikler med fokus på infrastruktur, automatisering og sikkerhet. Basert i Askøy, Vestland.',
    // Short form for social cards and the manifest.
    tagline: `${AUTHOR.roles.join(' · ')}. Infrastruktur, automatisering og sikkerhet.`,
    focus: 'Infrastruktur · Automatisering · Sikkerhet',
  },
  en: {
    roles: ROLES_EN,
    title: `${AUTHOR.name} – Systems Administrator & DevOps in Vestland, Norway`,
    description:
      'Systems administrator, DevOps engineer and developer focused on infrastructure, automation and security. Based in Askøy, Vestland, Norway.',
    tagline: `${ROLES_EN.join(' · ')}. Infrastructure, automation and security.`,
    focus: 'Infrastructure · Automation · Security',
  },
}

// The site-wide social card (lib/og-site-card.tsx renders it).
export const SITE_CARD_SIZE = { width: 1200, height: 630 }

export function siteCardAlt(lang: Lang): string {
  return `${AUTHOR.name} — ${SITE_COPY[lang].roles.join(' / ')}`
}

export const SITE_TITLE = SITE_COPY.nb.title
export const SITE_DESCRIPTION = SITE_COPY.nb.description
export const SITE_TAGLINE = SITE_COPY.nb.tagline

// Light/dark page backgrounds (body in app/globals.css). The browser chrome
// colour (viewport themeColor, manifest, ThemeContext) must match these, or
// the mobile address bar shows a different shade than the page under it.
export const THEME_BG = { light: '#fafafa', dark: '#030712' } as const
