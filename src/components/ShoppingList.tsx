'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'
import type { ShoppingLine } from '@/lib/mealPlan'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * The consolidated list. "have it" marks an ingredient as a pantry staple, which
 * drops it from this and every future list (pantry memory) — the page re-nets on
 * refresh with the new staple excluded.
 */
export function ShoppingList({ lines }: { lines: ShoppingLine[] }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const markStaple = async (line: ShoppingLine) => {
    if (!supabase) return
    setBusy(line.key)
    try {
      const { error } = await supabase
        .from('pantry')
        .upsert(
          { ingredient_slug: slugify(line.name), ingredient_name: line.name, is_staple: true },
          { onConflict: 'user_id,ingredient_slug' },
        )
      if (!error) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (lines.length === 0) {
    return <p className="mt-4 text-[0.9375rem] text-slate">Nothing to buy — add recipes to your week.</p>
  }

  return (
    <ul className="mt-4 grid list-none gap-2.5 p-0">
      {lines.map((line) => (
        <li key={line.key} className="grid gap-0.5 border-b border-rule pb-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[1.0625rem]">
              {line.name}
              {line.amounts.length > 0 && <span className="text-slate"> — {line.amounts.join(' + ')}</span>}
            </span>
            <button
              type="button"
              disabled={busy === line.key}
              onClick={() => void markStaple(line)}
              title="I always have this — hide it from the list"
              className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase underline-offset-2 hover:text-flame hover:underline disabled:opacity-50"
            >
              have it
            </button>
          </div>
          {line.recipes.length > 1 && (
            <span className="font-mono text-[0.6875rem] text-slate/70">for {line.recipes.join(', ')}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
