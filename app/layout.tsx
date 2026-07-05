import type { Metadata, Viewport } from 'next'
import { Intel_One_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import VisitBeacon from '@/components/effects/VisitBeacon'
import { SITE_URL, AUTHOR } from '@/lib/site'

const intelOneMono = Intel_One_Mono({
  subsets: ['latin'],
  // 400 body · 500 (font-medium) · 600 (prose <strong>/<h3>) · 700 (font-bold).
  // 300 dropped — unreferenced in markup and not a typography-plugin default.
  weight: ['400', '500', '600', '700'],
  variable: '--font-intel-mono',
  // display:optional, not swap. next/font ships no bundled metrics for Intel
  // One Mono, so adjustFontFallback can't synthesise a size-adjusted fallback
  // (verified: the build emits no "Intel One Mono Fallback" @font-face). With
  // display:swap that meant the whole page laid out in the system monospace
  // and then REFLOWED when the web font arrived — the visible text "jerk" on
  // first paint. `optional` gives the font a short block window and, if it
  // isn't ready, keeps the fallback for that paint and never swaps late — so
  // the layout can't shift. The font is immutably cached (see cacheControlFor),
  // so repeat visits and client-side navigations render Intel One Mono with no
  // shift; only a cold first paint may briefly use the system monospace.
  display: 'optional',
  // The font is applied via a CSS variable (Tailwind --font-sans/--font-mono)
  // rather than the generated className, so Next's automatic <link rel=preload>
  // points at files the browser can't tie to usage in time and logs
  // "preloaded but not used" warnings. Skip preloading; the cache does the
  // heavy lifting after the first visit.
  preload: false,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Dmytro Rozsoshnykh – Systemadministrator & DevOps i Vestland',
    template: '%s – Dmytro Rozsoshnykh',
  },
  description: 'Systemadministrator, DevOps og IT-driftstekniker med fokus på infrastruktur, automatisering og sikkerhet. Basert i Askøy, Vestland.',
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': '/feed.xml' },
  },
  openGraph: {
    title: 'Dmytro Rozsoshnykh – Systemadministrator & DevOps i Vestland',
    description: 'Systemadministrator · DevOps · IT-driftstekniker. Infrastruktur, automatisering og sikkerhet.',
    url: `${SITE_URL}/`,
    siteName: 'Dmytro Rozsoshnykh',
    locale: 'nb_NO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  // Mykt-lansering: domenet er på plass, men indeksering venter til de
  // første postene er publisert. Sett index: true når innholdet er klart,
  // og send inn sitemap i Search Console da.
  robots: {
    index: false,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: AUTHOR.name,
    jobTitle: AUTHOR.jobTitle,
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Askøy',
      addressRegion: 'Vestland',
      addressCountry: 'NO',
    },
    sameAs: AUTHOR.sameAs,
  }

  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: AUTHOR.name,
    url: SITE_URL,
    inLanguage: 'nb-NO',
    author: { '@type': 'Person', name: AUTHOR.name },
  }

  return (
    <html lang="nb" className={intelOneMono.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(location.pathname==='/'&&!sessionStorage.getItem('intro-seen')){var d=document.documentElement;d.classList.add('intro-active');setTimeout(function(){d.classList.remove('intro-active')},7500)}}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{console.log('%c● %cGod dag. Jeg er helt operasjonell, og alle kretsene mine fungerer perfekt.','color:#c00;font-size:14px','color:inherit;font-family:monospace')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <VisitBeacon />
        </ThemeProvider>
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "2f353dc40f0546b1962abda8ee34537d"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
