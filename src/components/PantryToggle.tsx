'use client'

import Link from 'next/link'
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

  const [userId, setUserId] = useState<string | null>(null)
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
        setUserId(data.user?.id ?? null)
        if (!isIn) {
          // RLS returns an empty set rather than an error when signed out, so
          // querying first would read as "not in your pantry" and hand back a
          // control that silently does nothing.
          setState('out')
          return
        }
        // Scoped to this user, not just the slug. The RLS policy is
        // `user_id = auth.uid() OR household_id = my_household_id()`, so in a
        // shared household an unscoped read matches a partner's row too —
        // maybeSingle() then errors on multiple rows and the button lies.
        const { data: row } = await supabase
          .from('pantry')
          .select('ingredient_slug')
          .eq('user_id', data.user!.id)
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
        : // Same reason, with teeth: an unscoped delete would remove a
          // household partner's row as well as your own.
          await supabase.from('pantry').delete().eq('user_id', userId!).eq('ingredient_slug', slug)
    if (error) setState(state)
    else router.refresh()
    setBusy(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={signedIn ? state === 'in' : undefined}
        className="chip w-fit disabled:opacity-60"
      >
        {!signedIn ? 'Sign in to track this' : state === 'in' ? '✓ In your pantry' : '+ I have this'}
      </button>
      {/* Adding a thing to the pantry is only useful because of what it
          unlocks — say so, the same way the shopping basket does. */}
      {signedIn && state === 'in' && (
        <Link
          href="/cook-from"
          className="font-mono text-[0.75rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
        >
          What can I cook? →
        </Link>
      )}
    </div>
  )
}
