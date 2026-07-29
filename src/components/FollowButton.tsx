'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Follow/unfollow a creator by their author slug. Signed out → routes to /account.
 *
 * `tone` exists because this button lives on two different grounds: the
 * creator page's dark pan hero, and paper cards on the feed. The milk palette
 * is right on the first and invisible on the second — near-white text on a
 * near-white card in light theme.
 */
export function FollowButton({
  authorSlug,
  tone = 'paper',
}: {
  authorSlug: string
  /** 'pan' for the dark creator hero; 'paper' anywhere the page background shows. */
  tone?: 'paper' | 'pan'
}) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [state, setState] = useState<'unknown' | 'out' | 'following'>('unknown')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setState('out')
      return
    }
    let active = true
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        setState('out')
        return
      }
      const { data } = await supabase.from('follows').select('author_slug').eq('author_slug', authorSlug).maybeSingle()
      if (active) setState(data ? 'following' : 'out')
    })()
    return () => {
      active = false
    }
  }, [supabase, authorSlug])

  const toggle = async () => {
    if (!supabase || busy) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/account')
      return
    }
    setBusy(true)
    try {
      // Only flip once the write actually landed — a silent failure would show
      // "Following" for a follow that never persisted (same rule as SaveRecipe).
      if (state === 'following') {
        const { error } = await supabase.from('follows').delete().eq('author_slug', authorSlug)
        if (!error) setState('out')
      } else {
        const { error } = await supabase.from('follows').insert({ author_slug: authorSlug })
        if (!error) setState('following')
      }
    } finally {
      setBusy(false)
    }
  }

  if (state === 'unknown') return null

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      data-active={state === 'following'}
      className={
        tone === 'pan'
          ? 'chip !border-milk/40 !text-milk hover:!border-flame data-[active=true]:!border-flame data-[active=true]:!text-flame'
          : // Plain chip: its own tokens already resolve for both themes, so it
            // stays readable on paper in light and dark alike.
            'chip data-[active=true]:!border-flame data-[active=true]:!text-flame'
      }
    >
      {state === 'following' ? '✓ Following' : '+ Follow'}
    </button>
  )
}
