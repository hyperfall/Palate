import type { Metadata, Viewport } from 'next'
import { Figtree, IBM_Plex_Mono, Young_Serif } from 'next/font/google'
import React from 'react'

import { ConsentProvider } from '@/components/ConsentManager'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { MobileNav } from '@/components/MobileNav'
import { QuizNudge } from '@/components/QuizNudge'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { SITE } from '@/lib/site'

import './styles.css'

/*
 * Three voices, three jobs — the type system of a service kitchen:
 *  · Young Serif — the menu voice. Titles only, used with restraint.
 *  · IBM Plex Mono — the ticket printer. Every label, number, and measurement.
 *  · Figtree — the plain speaking voice for method text and UI prose.
 */
const youngSerif = Young_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-young-serif',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    siteName: SITE.name,
    type: 'website',
  },
  // iOS ignores the manifest for these: without them, "Add to Home Screen"
  // gives a screenshot-thumbnail icon and still opens inside Safari chrome.
  appleWebApp: {
    capable: true,
    title: 'Palate',
    // Dark bar over the pan-coloured header, rather than a pale strip above it.
    statusBarStyle: 'black-translucent',
  },
  // Every icon is declared here, deliberately. Setting metadata.icons at all
  // REPLACES the app-router file convention's generated links — so adding just
  // `apple` for the PWA work silently removed <link rel="icon"> and the site
  // lost its favicon. Listing them is the only safe shape once this key exists.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icon-32.png',
    apple: '/apple-icon-180.png',
  },
}

/**
 * themeColor belongs to viewport, not metadata (Next warns otherwise). Both
 * schemes are declared so the browser chrome follows the site's own theme
 * toggle rather than sitting light above a dark page.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#26301f' },
    { media: '(prefers-color-scheme: dark)', color: '#14100c' },
  ],
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html
      lang="en"
      className={`${youngSerif.variable} ${plexMono.variable} ${figtree.variable}`}
      // Tells Next the smooth scroll is intentional, so route transitions
      // opt out of it cleanly instead of warning.
      data-scroll-behavior="smooth"
      // data-theme is stamped by the boot script before React hydrates.
      suppressHydrationWarning
    >
      {/*
        On phones the fixed bottom tab bar overlays the page, so the body carries
        matching bottom clearance (bar height + home-indicator safe area). Desktop
        has no bar, so the padding is removed at sm+.
      */}
      <body className="flex min-h-screen flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        {/*
          Theme boot — runs synchronously before any content paints, so there
          is no light-mode flash. Stored choice wins; otherwise the OS decides.
        */}
        {/*
          Theme boot. Base theming is pure CSS (light-dark() + color-scheme,
          following the OS), so this only replays an explicit stored override —
          before first paint, so a saved choice never flashes the OS theme.
          Delivered via innerHTML on a hidden div: the browser's HTML parser
          executes it from the server-rendered markup, while React only ever
          sees opaque innerHTML — no script element, no hydration warning.
        */}
        {/*
          Allowed by 'unsafe-inline' in the CSP (see src/proxy.ts for why this
          site cannot use a nonce or a hash). It no longer has a hash of its
          own to keep in sync, so editing the script text below is safe.
        */}
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html:
              "<script>try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>",
          }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        <ConsentProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <MobileNav />
          <QuizNudge />
          <GoogleAnalytics />
        </ConsentProvider>
      </body>
    </html>
  )
}
