'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Put one ingredient in (or out of) the pantry from its own page.
 *
 * The pantry is what makes cook-from work, and filling it used to mean going to
 * /cook-from and typing each item into a search box. Browsing the pantry index
 * and tapping the things you own is a far shorter road to the same place.
 *
 * Renders nothing until the session is known, so a signed-out reader is never
 * shown a control that would only bounce them to sign-in.
 */
export function PantryToggle({ slug, name }: { slug: string; name: string }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [state, setState] = useState<'unknown' | 'out' | 'in'>('unknown')
  const [busy, setBusy] = useState(false)

  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false)
      setState('out')
      return
    }
    let cancelled = false
    void supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (cancelled) return
        const isIn = Boolean(data.user)
        setSignedIn(isIn)
        if (!isIn) {
          // RLS returns an empty set rather than an error when signed out, so
          // querying first would read as "not in your pantry" and hand back a
          // control that silently does nothing.
          setState('out')
          return
        }
        const { data: row } = await supabase
          .from('pantry')
          .select('ingredient_slug')
          .eq('ingredient_slug', slug)
          .maybeSingle()
        if (!cancelled) setState(row ? 'in' : 'out')
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, slug])

  if (state === 'unknown' || signedIn === null) return null

  const toggle = async () => {
    if (!supabase || busy) return
    if (!signedIn) {
      // Same move the follow button makes: the ask is the invitation.
      router.push('/account')
      return
    }
    setBusy(true)
    // Optimistic: the row is tiny and the failure path just puts it back.
    const next = state === 'in' ? 'out' : 'in'
    setState(next)
    const { error } =
      next === 'in'
        ? await supabase
            .from('pantry')
            .upsert(
              { ingredient_slug: slug, ingredient_name: name, is_staple: false },
              { onConflict: 'user_id,ingredient_slug' },
            )
        : await supabase.from('pantry').delete().eq('ingredient_slug', slug)
    if (error) setState(state)
    else router.refresh()
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={signedIn ? state === 'in' : undefined}
      className="chip w-fit disabled:opacity-60"
    >
      {!signedIn ? 'Sign in to track this' : state === 'in' ? '✓ In your pantry' : '+ I have this'}
    </button>
  )
}
