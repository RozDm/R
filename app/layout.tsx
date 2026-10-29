import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import VisitBeacon from '@/components/effects/VisitBeacon'
import HtmlLang from '@/components/effects/HtmlLang'
import { SITE_URL, AUTHOR, SITE_TITLE, SITE_DESCRIPTION, SITE_TAGLINE, THEME_BG } from '@/lib/site'
import { RSS_ALTERNATE, personJsonLd as buildPersonJsonLd, serializeJsonLd } from '@/lib/metadata'
import { fontClasses } from '@/lib/fonts'

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
  const personJsonLd = buildPersonJsonLd()

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
      className={fontClasses}
      // globals.css sets `scroll-behavior: smooth` for in-page anchors. This
      // attribute lets Next switch it off while it resets scroll on a route
      // change; without it that reset animates, Next's follow-up
      // scrollIntoView calls cancel it, and the new page opens mid-scroll.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Theme before the first paint; and lang="en" on any /en/ path —
            the build already writes it into the /en/ pages, but the one
            404.html also answers /en/ misses, and its English copy shows on
            html[lang=en] (app/not-found.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement,p=location.pathname;if(p==='/en'||p.indexOf('/en/')===0)d.lang='en';try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)){d.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {/* The intro is the front door only: a visitor who lands on any other
            page (a post from search, /kontakt) or on a /#hash deep link (the
            /status redirect, a shared /#skills link) is marked as having seen
            it, so a later click to the home page never hijacks them with the
            11-second sequence. Only a visitor's first plain load of / or /en/
            plays it (the flag is in localStorage: once per visitor, not per
            tab) — and never under prefers-reduced-motion (Intro skips it there anyway;
            raising the black cover would only hold it until hydration). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage,p=location.pathname;if((p!=='/'&&p!=='/en/')||location.hash||matchMedia('(prefers-reduced-motion: reduce)').matches){s.setItem('intro-seen','1')}else if(!s.getItem('intro-seen')){var d=document.documentElement;d.classList.add('intro-active');setTimeout(function(){d.classList.remove('intro-active')},7500)}}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(personJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(webSiteJsonLd) }}
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
      </body>
    </html>
  )
}
