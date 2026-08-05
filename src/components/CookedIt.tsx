'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format'

/**
 * Record that this recipe was actually cooked.
 *
 * Saving a recipe records intent; this records the act — which is what makes
 * "cook it again" possible, and it is the only honest source for the "cooked"
 * number a creator sees. Repeat cooks are the point, so every press writes a
 * new row rather than toggling one.
 *
 * The optional note is for the cook's future self ("half the chilli") and is
 * never shown to anyone else — the creator dashboard reads counts only.
 */
export function CookedIt({
  slug,
  title,
  image = null,
  tone = 'light',
}: {
  slug: string
  title: string
  image?: string | null
  /** 'dark' sits on the pan-coloured hero; 'light' on paper. */
  tone?: 'light' | 'dark'
}) {
  const supabase = supabaseBrowser()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [state, setState] = useState<'idle' | 'noting' | 'saving' | 'logged'>('idle')
  const [note, setNote] = useState('')
  const [lastCooked, setLastCooked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false)
      return
    }
    let cancelled = false
    void supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (cancelled) return
        if (!data.user) {
          setSignedIn(false)
          return
        }
        setSignedIn(true)
        // Scoped to this user: the policy is own-rows-only, but being explicit
        // keeps it correct if the policy ever widens the way the pantry's did.
        const { data: rows } = await supabase
          .from('cook_log')
          .select('cooked_at')
          .eq('user_id', data.user.id)
          .eq('recipe_slug', slug)
          .order('cooked_at', { ascending: false })
          .limit(1)
        if (!cancelled && rows?.[0]) setLastCooked(rows[0].cooked_at as string)
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, slug])

  if (signedIn === null) return null

  const log = async () => {
    if (!supabase) return
    setState('saving')
    setError(null)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      setSignedIn(false)
      return
    }
    const { error: err } = await supabase.from('cook_log').insert({
      user_id: auth.user.id,
      recipe_slug: slug,
      recipe_title: title,
      recipe_image: image,
      note: note.trim() ? note.trim().slice(0, 500) : null,
    })
    if (err) {
      setError('Couldn’t save that. Try again.')
      setState('noting')
      return
    }
    setLastCooked(new Date().toISOString())
    setNote('')
    setState('logged')
  }

  const muted = tone === 'dark' ? 'text-milk/70' : 'text-slate'

  if (!signedIn) {
    return (
      <p className={`m-0 font-mono text-caption tracking-[0.08em] uppercase ${muted}`}>
        <Link href="/account" className="underline underline-offset-4 hover:text-flame">
          Sign in
        </Link>{' '}
        to keep a record of what you cook
      </p>
    )
  }

  if (state === 'logged') {
    return (
      <p className={`m-0 font-mono text-caption tracking-[0.08em] uppercase ${muted}`}>
        ✓ Logged. It’s on your shelf of things you actually made.
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      {state === 'noting' ? (
        <div className="grid max-w-[26rem] gap-2">
          <label className="grid gap-1">
            <span className={`font-mono text-tag tracking-[0.08em] uppercase ${muted}`}>
              Anything to remember? (optional, only you see it)
            </span>
            <input
              type="text"
              value={note}
              maxLength={500}
              autoFocus
              placeholder="Half the chilli next time"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void log()
              }}
              className="rounded border border-rule bg-transparent px-3 py-2 font-body text-note text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void log()} className="chip w-fit">
              Save it
            </button>
            <button
              type="button"
              onClick={() => void log()}
              className={`cursor-pointer border-none bg-transparent p-0 font-mono text-caption tracking-[0.1em] uppercase underline-offset-4 hover:underline ${muted}`}
            >
              Skip the note
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setState('noting')}
          disabled={state === 'saving'}
          className="chip w-fit disabled:opacity-60"
        >
          {state === 'saving' ? 'Saving…' : '✓ I cooked this'}
        </button>
      )}
      {lastCooked && state === 'idle' && (
        <p className={`m-0 font-mono text-tag tracking-[0.06em] uppercase ${muted}`}>
          Last cooked {formatDate(lastCooked)}
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 font-mono text-caption text-heat">
          {error}
        </p>
      )}
    </div>
  )
}
