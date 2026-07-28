'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'
import { adoptRemoteUnitSystem } from '@/lib/useUnitSystem'

/**
 * Session-aware account corner: signed out it's a "Sign in" link; signed in it's
 * an avatar button that opens a dropdown menu (profile header + Dashboard /
 * Settings / Studio / Feed / Sign out). Auth changes flip it live. The menu is
 * keyboard-friendly: Esc and outside-click close it, focus lands on the first
 * item when it opens.
 */

const linkClass =
  'font-mono text-[0.875rem] font-medium tracking-[0.12em] text-milk/90 uppercase no-underline transition-colors hover:text-flame'

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

type Session = { email: string | null; name: string | null; avatarUrl: string | null; creator: boolean }

export function NavAccount() {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [session, setSession] = useState<Session>({ email: null, name: null, avatarUrl: null, creator: false })
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false)
      return
    }
    const read = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      setSignedIn(Boolean(user))
      setSession({
        email: user?.email ?? null,
        name: (user?.user_metadata?.display_name as string | undefined) ?? null,
        avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
        creator: user?.user_metadata?.account_type === 'creator',
      })
      // A units choice saved on the account follows the person to devices that
      // haven't chosen locally yet. NavAccount mounts on every page, so this
      // happens wherever they land, not only on /account.
      const units = user?.user_metadata?.unit_system
      if (units === 'us' || units === 'metric') adoptRemoteUnitSystem(units)
    }
    supabase.auth
      .getUser()
      .then(({ data }) => read(data.user))
      .catch(() => setSignedIn(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => read(s?.user ?? null))
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  // Close on outside click / Escape; focus the first item when opening.
  useEffect(() => {
    if (!open) return
    firstItemRef.current?.focus()
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const signOut = async () => {
    try {
      await supabase?.auth.signOut()
    } catch {
      /* local state clears regardless */
    }
    setOpen(false)
    router.refresh()
  }

  if (signedIn === null) return null
  if (!signedIn) {
    return (
      <Link href="/account" className={linkClass}>
        Sign in
      </Link>
    )
  }

  // "Saved" matches what the footer, the mobile tab bar and the page's own
  // eyebrow call it. Settings sits last, where configuration belongs, rather
  // than second — the reader's own shelves come before their preferences.
  const menuItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/collections', label: 'Saved' },
    { href: '/feed', label: 'Feed' },
    ...(session.creator ? [{ href: '/studio', label: 'Studio' }] : []),
    { href: '/account', label: 'Settings' },
  ]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-milk/25 bg-milk/5 text-milk/90 transition-colors hover:border-flame hover:text-flame"
      >
        {session.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small avatar from user metadata
          <img src={session.avatarUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          <PersonIcon />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-60 overflow-hidden rounded-lg border border-ink/15 bg-card shadow-block"
        >
          <div className="flex items-center gap-3 border-b border-rule px-4 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-rule bg-wash text-slate">
              {session.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar
                <img src={session.avatarUrl} alt="" width={36} height={36} className="h-full w-full object-cover" />
              ) : (
                <PersonIcon />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-body text-[0.9375rem] font-semibold text-ink">
                {session.name ?? session.email ?? 'Your account'}
              </span>
              {session.email && <span className="block truncate font-mono text-[0.6875rem] text-slate">{session.email}</span>}
            </span>
          </div>

          <nav className="grid py-1.5">
            {menuItems.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                ref={i === 0 ? firstItemRef : undefined}
                onClick={() => setOpen(false)}
                className="px-4 py-2 font-body text-[0.9375rem] text-ink no-underline transition-colors hover:bg-wash hover:text-flame"
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
              className="mt-1 border-t border-rule px-4 py-2.5 text-left font-body text-[0.9375rem] text-heat no-underline transition-colors hover:bg-wash"
            >
              Sign out
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
