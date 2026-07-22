'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { StarRating } from '@/components/StarRating'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Rate a recipe 1–5 stars, on the recipe page. Signed out, it shows the current
 * average (or a "be the first" nudge) and a link to /account. Signed in, the
 * stars are clickable — one vote per user, re-clickable to change it. The
 * server-rendered average/count seed the display so there's no empty flash; the
 * viewer's own prior vote loads in on mount.
 */
export function RateWidget({
  recipeId,
  initialAverage,
  initialCount,
}: {
  recipeId: number
  initialAverage: number
  initialCount: number
}) {
  const supabase = supabaseBrowser()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [average, setAverage] = useState(initialAverage)
  const [count, setCount] = useState(initialCount)
  const [yourStars, setYourStars] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false)
      return
    }
    let active = true
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!active) return
        const isIn = Boolean(data.user)
        setSignedIn(isIn)
        // Pull the viewer's own vote (and a fresh tally) once we know they're in.
        if (isIn) {
          try {
            const res = await fetch(`/recipe/rate?recipeId=${recipeId}`)
            if (res.ok && active) {
              const d = await res.json()
              setAverage(d.average)
              setCount(d.count)
              setYourStars(d.yourStars)
            }
          } catch {
            // Keep the SSR seed values on a network hiccup.
          }
        }
      })
      .catch(() => active && setSignedIn(false))
    return () => {
      active = false
    }
  }, [supabase, recipeId])

  const submit = async (stars: number) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/recipe/rate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipeId, stars }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save your rating.')
      setAverage(data.average)
      setCount(data.count)
      setYourStars(data.yourStars)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your rating.')
    } finally {
      setBusy(false)
    }
  }

  const hasRatings = count > 0

  return (
    <div className="grid gap-2">
      <p className="eyebrow m-0">Rate this recipe</p>

      {signedIn ? (
        <>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((star) => {
              const shown = hover ?? yourStars ?? 0
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={yourStars === star}
                  aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  disabled={busy}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(star)}
                  onBlur={() => setHover(null)}
                  onClick={() => void submit(star)}
                  className={`cursor-pointer border-none bg-transparent p-0 text-[1.75rem] leading-none transition-colors disabled:cursor-default ${
                    star <= shown ? 'text-flame' : 'text-rule hover:text-flame/60'
                  }`}
                >
                  ★
                </button>
              )
            })}
          </div>
          <p className="m-0 font-mono text-[0.75rem] text-slate">
            {yourStars
              ? `You rated this ${yourStars}★.`
              : hasRatings
                ? 'Tap a star to add your rating.'
                : 'Be the first to rate this.'}{' '}
            {hasRatings && (
              <span className="text-slate/80">
                Community: {average.toFixed(1)}★ ({count})
              </span>
            )}
          </p>
          {error && <p className="m-0 font-mono text-[0.75rem] text-heat">{error}</p>}
        </>
      ) : (
        <>
          {hasRatings ? (
            <StarRating value={average} count={count} size="lg" />
          ) : (
            <p className="m-0 font-mono text-[0.8125rem] text-slate">No ratings yet.</p>
          )}
          <p className="m-0 font-mono text-[0.75rem] text-slate">
            <Link href="/account" className="text-flame no-underline hover:underline">
              Sign in
            </Link>{' '}
            to rate this recipe.
          </p>
        </>
      )}
    </div>
  )
}
