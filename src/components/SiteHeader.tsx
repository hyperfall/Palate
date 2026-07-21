import Link from 'next/link'

import { SITE } from '@/lib/site'
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
      <div className="shell flex flex-wrap items-center gap-x-6 gap-y-2.5 py-3">
        <Link
          href="/"
          className="font-display text-[1.375rem] leading-none text-milk no-underline"
        >
          {SITE.name}
        </Link>

        <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:px-4 lg:px-10">
          <NavSearch />
        </div>

        <nav
          aria-label="Main"
          className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1.5 sm:ml-0 sm:gap-x-7"
        >
          <Link
            href="/tonight"
            className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-flame-text uppercase no-underline transition-colors hover:text-milk"
          >
            Tonight
          </Link>
          <Link
            href="/taste-night"
            className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-milk/85 uppercase no-underline transition-colors hover:text-flame"
          >
            Quiz
          </Link>
          <Link
            href="/students"
            className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-milk/85 uppercase no-underline transition-colors hover:text-flame"
          >
            Students
          </Link>
          <Link
            href="/recipes"
            className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-milk/85 uppercase no-underline transition-colors hover:text-flame"
          >
            Recipes
          </Link>
          <Link
            href="/cuisines"
            className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-milk/85 uppercase no-underline transition-colors hover:text-flame"
          >
            Cuisines
          </Link>
          <NavAccount />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
