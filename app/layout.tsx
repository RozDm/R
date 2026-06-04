import type { Metadata, Viewport } from 'next'
import { Intel_One_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import { SITE_URL, AUTHOR } from '@/lib/site'

const intelOneMono = Intel_One_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-intel-mono',
  display: 'swap',
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
  title: 'Dmytro Rozsoshnykh – Systemadministrator & DevOps',
  description: 'Systemadministrator, DevOps og IT-driftstekniker med fokus på infrastruktur, automatisering og sikkerhet. Basert i Askøy, Vestland.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Dmytro Rozsoshnykh – Systemadministrator & DevOps',
    description: 'Systemadministrator · DevOps · IT-driftstekniker. Infrastruktur, automatisering og sikkerhet.',
    url: `${SITE_URL}/`,
    locale: 'nb_NO',
    type: 'website',
  },
  robots: {
    index: true,
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
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
