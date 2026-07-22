'use client'

import { useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'

/** Creates a public, read-only share link for the current week's plan/list. */
export function SharePlan({ slugs }: { slugs: string[] }) {
  const supabase = supabaseBrowser()
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const share = async () => {
    if (!supabase || busy || slugs.length === 0) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('plan_shares')
        .insert({ recipe_slugs: slugs })
        .select('id')
        .single()
      if (!error && data) setUrl(`${window.location.origin}/plan/shared/${data.id}`)
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
            className="min-w-0 flex-1 rounded border border-rule bg-transparent px-2 py-1 font-mono text-[0.75rem] text-ink"
          />
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(url)}
            className="chip"
          >
            Copy
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={busy || slugs.length === 0}
      onClick={() => void share()}
      className="chip disabled:opacity-50"
    >
      Share this week
    </button>
  )
}
