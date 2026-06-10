import type { Metadata, Viewport } from 'next'
import { Intel_One_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import { SITE_URL, AUTHOR } from '@/lib/site'

const intelOneMono = Intel_One_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-intel-mono',
  display: 'swap',
  adjustFontFallback: false,
  // The font is applied via a CSS variable (Tailwind --font-sans/--font-mono)
  // rather than the generated className, so Next's automatic <link rel=preload>
  // points at files the browser can't tie to usage in time and logs
  // "preloaded but not used" warnings. display: swap already avoids FOIT, so
  // skip preloading and let the font load on demand.
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
            __html: `(function(){try{if(location.pathname==='/'&&!sessionStorage.getItem('intro-seen')){var d=document.documentElement;d.classList.add('intro-active');setTimeout(function(){d.classList.remove('intro-active')},5000)}}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
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
