import type { Metadata } from 'next'
import { Figtree, IBM_Plex_Mono, Young_Serif } from 'next/font/google'
import React from 'react'

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
}

export default async function RootLayout(props: { children: React.ReactNode }) {
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
      <body className="flex min-h-screen flex-col">
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
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
