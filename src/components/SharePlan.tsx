'use client'

import { useState } from 'react'

import { weekDishCount, type WeekSnapshot } from '@/lib/mealPlan'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Creates a public, read-only share link for the week — snapshotting the full
 * structure (day + meal + dish) so the shared card renders faithfully and stays
 * immutable if the planner later changes their week. A flat slug list rides
 * along for back-compat with the old reader.
 */
export function SharePlan({ week }: { week: WeekSnapshot }) {
  const supabase = supabaseBrowser()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const empty = weekDishCount(week) === 0

  const share = async () => {
    if (!supabase || busy || empty) return
    setBusy(true)
    setError(null)
    try {
      const slugs = week.days.flatMap((d) => d.meals.flatMap((m) => m.dishes.map((dish) => dish.slug)))
      const { data, error } = await supabase
        .from('plan_shares')
        .insert({ week, recipe_slugs: slugs })
        .select('id')
        .single()
      if (error) setError(error.message)
      else if (data) setUrl(`${window.location.origin}/plan/shared/${data.id}`)
    } finally {
      setBusy(false)
    }
  }

  if (url) {
    return (
      <div className="grid gap-1">
        <span className="eyebrow">Share link</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded border border-rule bg-transparent px-2 py-1 font-mono text-caption text-ink"
          />
          <button
            type="button"
            onClick={async () => {
              // Same confirmation the household invite and shopping list give —
              // a copy button that reports nothing looks broken.
              try {
                await navigator.clipboard?.writeText(url)
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              } catch {
                /* clipboard blocked */
              }
            }}
            className="chip"
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-1">
      <button type="button" disabled={busy || empty} onClick={() => void share()} className="chip disabled:opacity-50">
        Share this week
      </button>
      {error && (
        <span className="font-mono text-[0.7rem] text-flame" role="alert">
          Couldn&rsquo;t create link: {error}
        </span>
      )}
    </div>
  )
}
