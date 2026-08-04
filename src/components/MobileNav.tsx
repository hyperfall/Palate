'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { useDialogFocus } from '@/lib/useDialogFocus'
import { supabaseBrowser } from '@/lib/supabase/client'
import { ThemeToggle } from './ThemeToggle'

/**
 * The mobile app-shell nav: a fixed bottom bar with four thumb tabs and a
 * center chevron that expands the full menu as a bottom sheet (all destinations,
 * auth actions, and appearance) — one surface, nothing hidden off-screen. Phones
 * only (lg:hidden); desktop uses the inline top nav.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

type NavItem = { href: string; label: string; icon: ReactNode }

const NAV: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v9h12v-9" />
        <path d="M10 19v-5h4v5" />
      </svg>
    ),
  },
  {
    href: '/recipes',
    label: 'Recipes',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M4 12h16" />
        <path d="M6 12a6 6 0 0 0 12 0" />
        <path d="M9 12V6M15 12V6" />
      </svg>
    ),
  },
  {
    href: '/tonight',
    label: 'Tonight',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M12 3v18M3 12h18" />
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    ),
  },
  {
    href: '/cook-from',
    label: 'Cook from',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M4 11h16l-1.4 7.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8z" />
        <path d="M6 11a6 6 0 0 1 12 0" />
        <path d="M12 3v3" />
      </svg>
    ),
  },
  {
    // The planner is a top-level destination on desktop but had no entry here
    // at all, so on any screen using this menu the whole meal planner was
    // reachable only by typing the URL. A week grid: seven days, one marked.
    href: '/plan',
    label: 'Plan',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <rect x="6.5" y="13" width="4" height="4" rx="0.75" />
      </svg>
    ),
  },
  {
    // The cost calculator. A tag with a value on it.
    href: '/calculator',
    label: 'Calculator',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M20.5 12.5 12 21l-9-9V3h9z" />
        <circle cx="7.5" cy="7.5" r="1.4" />
      </svg>
    ),
  },
  {
    href: '/students',
    label: 'Students',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M12 4 2 9l10 5 10-5z" />
        <path d="M6 11.5V16c0 1.1 2.7 2 6 2s6-.9 6-2v-4.5" />
      </svg>
    ),
  },
  {
    href: '/cuisines',
    label: 'Cuisines',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.8 2.6 2.8 15.4 0 18M12 3c-2.8 2.6-2.8 15.4 0 18" />
      </svg>
    ),
  },
  {
    href: '/ranking/all',
    label: 'Ranking',
    icon: (
      // Three bars on a podium — a standings mark, not another list glyph.
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M4 20h16" />
        <rect x="5" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="7" width="4" height="13" rx="1" />
        <rect x="15" y="15" width="4" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: '/collections',
    label: 'Saved',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <path d="M6 4h12v16l-6-4-6 4z" />
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" />
      </svg>
    ),
  },
]

/** The four quick tabs that flank the center chevron. */
const TAB_HREFS = ['/', '/recipes', '/collections', '/account']

/**
 * Defined at module scope, not inside MobileNav: a component created during
 * render is a new type on every render, so React unmounts and remounts the
 * whole tab — throwing away its DOM and any transition mid-flight — every time
 * the route or sheet state changes.
 */
function Tab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 py-1.5 no-underline transition-colors ${
        active ? 'text-flame-text' : 'text-milk/65 hover:text-milk'
      }`}
    >
      {item.icon}
      <span className="font-mono text-micro font-medium tracking-[0.06em] uppercase">
        {item.label}
      </span>
    </Link>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  const supabase = supabaseBrowser()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<{
    signedIn: boolean
    label: string | null
    email: string | null
    avatarUrl: string | null
    creator: boolean
  }>({ signedIn: false, label: null, email: null, avatarUrl: null, creator: false })

  useEffect(() => {
    if (!supabase) return
    const read = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) =>
      setSession({
        signedIn: Boolean(user),
        label:
          (user?.user_metadata?.username as string | undefined) ??
          (user?.user_metadata?.display_name as string | undefined) ??
          null,
        email: user?.email ?? null,
        avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
        creator: user?.user_metadata?.account_type === 'creator',
      })
    supabase.auth
      .getUser()
      .then(({ data }) => read(data.user))
      .catch(() => {})
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => read(s?.user ?? null))
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  // Any navigation closes the sheet.
  useEffect(() => setOpen(false), [pathname])

  // Focus in, trap Tab, Escape out, scroll lock — the only nav on phones, so
  // it has to be fully operable from a keyboard or screen reader.
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeSheet = useCallback(() => setOpen(false), [])
  useDialogFocus({ open, ref: sheetRef, onClose: closeSheet })

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  const tabs = TAB_HREFS.map((h) => NAV.find((n) => n.href === h)!).filter(Boolean)

  return (
    <>
      {/* Bottom sheet — the full menu, sitting just above the bar. */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
          <div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-50 max-h-[74vh] overflow-y-auto rounded-t-2xl border-t border-rule bg-paper text-ink shadow-block lg:hidden"
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-rule" />
            <div className="flex items-center justify-between px-5 pt-2 pb-1">
              <span className="font-display text-title">Palate</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full border border-rule text-slate transition-colors hover:text-ink"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <nav aria-label="All sections" className="px-2 pb-1">
              <ul className="m-0 list-none p-0">
                {NAV.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center gap-3.5 rounded-lg border-l-2 px-4 py-3 no-underline transition-colors ${
                          active
                            ? 'border-flame bg-flame/10 text-flame'
                            : 'border-transparent text-ink hover:bg-wash'
                        }`}
                      >
                        <span className={active ? 'text-flame' : 'text-slate'}>{item.icon}</span>
                        <span className="text-read font-medium">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Account — mirrors the desktop dropdown: profile + menu. */}
            <div className="border-t border-rule px-5 py-4">
              {session.signedIn ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-rule bg-wash text-slate">
                      {session.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- small avatar
                        <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}>
                          <circle cx="12" cy="8.5" r="3.5" />
                          <path d="M5.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-body text-[1rem] font-semibold text-ink">
                        {session.label ? `@${session.label}` : 'Your account'}
                      </span>
                      {session.email && (
                        <span className="block truncate font-mono text-caption text-slate">{session.email}</span>
                      )}
                    </span>
                  </div>
                  <nav aria-label="Account" className="mt-3 grid">
                    <Link href="/dashboard" className="py-2 font-body text-[1rem] text-ink no-underline hover:text-flame">
                      Dashboard
                    </Link>
                    <Link href="/account" className="py-2 font-body text-[1rem] text-ink no-underline hover:text-flame">
                      Settings
                    </Link>
                    {session.creator && (
                      <Link href="/studio" className="py-2 font-body text-[1rem] text-ink no-underline hover:text-flame">
                        Studio
                      </Link>
                    )}
                    <Link href="/feed" className="py-2 font-body text-[1rem] text-ink no-underline hover:text-flame">
                      Feed
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await supabase?.auth.signOut()
                        } catch {
                          /* local state clears regardless */
                        }
                        setOpen(false)
                      }}
                      className="mt-1 border-t border-rule py-2.5 text-left font-body text-[1rem] text-heat"
                    >
                      Sign out
                    </button>
                  </nav>
                </>
              ) : (
                <div className="grid gap-2">
                  <Link href="/account" className="btn-primary justify-center text-center">
                    Create account
                  </Link>
                  <Link
                    href="/account"
                    className="rounded border border-rule px-4 py-2.5 text-center font-mono text-detail font-medium tracking-[0.1em] text-ink uppercase no-underline transition-colors hover:border-ink"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </div>

            {/* Appearance — theme control folded in, like the reference. */}
            <div className="flex items-center justify-between border-t border-rule px-5 py-3.5">
              <span className="font-body text-note text-slate">Appearance</span>
              <ThemeToggle colorClass="border-ink/25 text-ink" />
            </div>
          </div>
        </>
      )}

      {/* The bar itself — always above the backdrop so the chevron can close. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-pan-line bg-pan text-milk lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="m-0 grid list-none grid-cols-5 p-0">
          <li>{tabs[0] && <Tab item={tabs[0]} active={isActive(tabs[0].href)} />}</li>
          <li>{tabs[1] && <Tab item={tabs[1]} active={isActive(tabs[1].href)} />}</li>
          <li>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className={`flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 py-1.5 transition-colors ${
                open ? 'text-flame-text' : 'text-milk/80 hover:text-milk'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                {...stroke}
                className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              >
                <path d="M6 15l6-6 6 6" />
              </svg>
              <span className="font-mono text-micro font-medium tracking-[0.06em] uppercase">
                Menu
              </span>
            </button>
          </li>
          <li>{tabs[2] && <Tab item={tabs[2]} active={isActive(tabs[2].href)} />}</li>
          <li>{tabs[3] && <Tab item={tabs[3]} active={isActive(tabs[3].href)} />}</li>
        </ul>
      </nav>
    </>
  )
}
