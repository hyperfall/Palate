import Link from 'next/link'

import { SITE } from '@/lib/site'
import { HeaderNav } from './HeaderNav'
import { NavAccount } from './NavAccount'
import { NavSearch } from './NavSearch'
import { ThemeToggle } from './ThemeToggle'

/**
 * The pass rail. Dark, thin, sticky — the way back to the catalog never
 * scrolls away (§1: nothing sits between a visitor and the food). On phones
 * the search drops to its own row so the wordmark and nav stay tappable.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-pan-line bg-pan text-milk">
      <div className="shell flex flex-wrap items-center gap-x-3 gap-y-2.5 py-2.5 sm:gap-x-6 sm:py-3">
        <Link
          href="/"
          className="shrink-0 font-display text-[1.375rem] leading-none text-milk no-underline"
        >
          {SITE.name}
        </Link>

        {/* Search shares the wordmark's row on phones (was its own full row);
            it only breaks out to a wider centre column at sm+. */}
        <div className="min-w-0 flex-1 sm:px-4 lg:px-10">
          <NavSearch />
        </div>

        <nav aria-label="Main" className="ml-auto flex items-center gap-4 sm:ml-0">
          {/*
            The full destination list lives up top on desktop; below that these
            move to the bottom tab bar, leaving a slim wordmark + search + theme
            top bar. Only the theme toggle (no bottom-bar equivalent) stays.

            It appears at lg, not sm. Eight links and a toggle measure ~727px,
            and at sm they were being shown into 680px of shell — so from 640px
            to about 780px the row ran off the right edge and took the whole
            document's horizontal scroll with it. iPad portrait (768px) sat
            squarely in that gap. The tighter gap at lg buys the search field
            room back on a 1024px screen, where the row is at its most crowded.
          */}
          <div className="hidden items-center gap-x-5 lg:flex xl:gap-x-7">
            <HeaderNav />
            <NavAccount />
            {/* Theme lives in the mobile menu drawer, so it's desktop-only here. */}
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
}
