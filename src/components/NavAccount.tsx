'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'

const linkClass =
  'font-mono text-[0.875rem] font-medium tracking-[0.12em] text-milk/90 uppercase no-underline transition-colors hover:text-flame'

/**
 * Session-aware corner of the nav: "Saved" only exists for people who can
 * actually have saved something. Signed out (or Supabase unconfigured) it
 * offers "Sign in" instead. Auth state changes flip it live — no refresh.
 */
/** A clean person glyph — the fallback when there's no avatar. */
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function NavAccount() {
  const supabase = supabaseBrowser()
  // null = unknown (render nothing → no signed-out flash before the check).
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [creator, setCreator] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false)
      return
    }
    const read = (user: { user_metadata?: Record<string, unknown> } | null) => {
      setSignedIn(Boolean(user))
      setCreator(user?.user_metadata?.account_type === 'creator')
      setAvatarUrl((user?.user_metadata?.avatar_url as string | undefined) ?? null)
    }
    supabase.auth
      .getUser()
      .then(({ data }) => read(data.user))
      // A failed check reads as "signed out" rather than leaving the nav stuck
      // rendering nothing forever.
      .catch(() => setSignedIn(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      read(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  if (signedIn === null) return null

  return signedIn ? (
    <>
      {creator && (
        <Link href="/studio" className={linkClass}>
          Studio
        </Link>
      )}
      <Link href="/collections" className={linkClass}>
        Saved
      </Link>
      <Link
        href="/account"
        aria-label="Account"
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-milk/25 bg-milk/5 text-milk/90 transition-colors hover:border-flame hover:text-flame"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small avatar from user metadata
          <img src={avatarUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          <PersonIcon />
        )}
      </Link>
    </>
  ) : (
    <Link href="/account" className={linkClass}>
      Sign in
    </Link>
  )
}
