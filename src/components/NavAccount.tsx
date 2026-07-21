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
export function NavAccount() {
  const supabase = supabaseBrowser()
  // null = unknown (render nothing → no signed-out flash before the check).
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [creator, setCreator] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false)
      return
    }
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setSignedIn(Boolean(data.user))
        setCreator(data.user?.user_metadata?.account_type === 'creator')
      })
      // A failed check reads as "signed out" rather than leaving the nav stuck
      // rendering nothing forever.
      .catch(() => setSignedIn(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user))
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
      <Link href="/account" aria-label="Account" className={linkClass}>
        ⌂
      </Link>
    </>
  ) : (
    <Link href="/account" className={linkClass}>
      Sign in
    </Link>
  )
}
