// Sentral konfigurasjon for nettstedet (brukt i metadata, sitemap og JSON-LD)
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

export const SITE_TITLE = `${AUTHOR.name} – Systemadministrator & DevOps i Vestland`
export const SITE_DESCRIPTION =
  'Systemadministrator, DevOps og utvikler med fokus på infrastruktur, automatisering og sikkerhet. Basert i Askøy, Vestland.'
// Short form for social cards and the manifest.
export const SITE_TAGLINE = `${AUTHOR.roles.join(' · ')}. Infrastruktur, automatisering og sikkerhet.`

// Light/dark page backgrounds (body in app/globals.css). The browser chrome
// colour (viewport themeColor, manifest, ThemeContext) must match these, or
// the mobile address bar shows a different shade than the page under it.
export const THEME_BG = { light: '#fafafa', dark: '#030712' } as const
