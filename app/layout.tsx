import type { Metadata, Viewport } from 'next'
import { Intel_One_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import VisitBeacon from '@/components/effects/VisitBeacon'
import HtmlLang from '@/components/effects/HtmlLang'
import { SITE_URL, AUTHOR, SITE_TITLE, SITE_DESCRIPTION, SITE_TAGLINE, THEME_BG } from '@/lib/site'
import { RSS_ALTERNATE } from '@/lib/metadata'

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
  // so repeat visits and client-side navigations render Intel One Mono.
  display: 'optional',
  // Preload is what makes `optional` work on a FIRST visit: without it the
  // woff2 is discovered only after the CSS is parsed, misses the ~100ms block
  // window, and a newcomer's whole first page renders in the system monospace
  // (measured live: DejaVu/Consolas on a cold load). It's a variable font, so
  // this is one ~21 KB latin file covering every weight.
  preload: true,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches the body background per scheme. ThemeContext rewrites both tags
  // to the active colour when the visitor overrides the OS scheme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_BG.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_BG.dark },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s – ${AUTHOR.name}`,
  },
  description: SITE_DESCRIPTION,
  // Fallbacks only — every page sets its own canonical/og:url through
  // pageMetadata() (lib/metadata.ts). No canonical or og:url here: whatever
  // inherits these (the 404 page) must not claim to be the home page.
  alternates: { types: RSS_ALTERNATE },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_TAGLINE,
    siteName: AUTHOR.name,
    locale: 'nb_NO',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  // Both listed explicitly: a config `icons` object replaces the file-based
  // app/icon.svg link instead of merging with it. iOS ignores SVG for the
  // home screen, so it gets the PNG from app/icons/[name]/route.tsx.
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: '/icons/apple-touch-icon.png',
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
    inLanguage: ['nb-NO', 'en-GB'],
    author: { '@type': 'Person', name: AUTHOR.name },
  }

  return (
    <html
      lang="nb"
      className={intelOneMono.variable}
      // globals.css sets `scroll-behavior: smooth` for in-page anchors. This
      // attribute lets Next switch it off while it resets scroll on a route
      // change; without it that reset animates, Next's follow-up
      // scrollIntoView calls cancel it, and the new page opens mid-scroll.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {/* The intro is the front door only: a visitor who lands on any other
            page (a post from search, /kontakt) or on a /#hash deep link (the
            /status redirect, a shared /#skills link) is marked as having seen
            it, so a later click to the home page never hijacks them with the
            11-second sequence. Only a plain first load of / or /en/ plays it — and
            never under prefers-reduced-motion (Intro skips it there anyway;
            raising the black cover would only hold it until hydration). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=sessionStorage,p=location.pathname;if((p!=='/'&&p!=='/en/')||location.hash||matchMedia('(prefers-reduced-motion: reduce)').matches){s.setItem('intro-seen','1')}else if(!s.getItem('intro-seen')){var d=document.documentElement;d.classList.add('intro-active');setTimeout(function(){d.classList.remove('intro-active')},7500)}}catch(e){}})()`,
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
          <HtmlLang />
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
