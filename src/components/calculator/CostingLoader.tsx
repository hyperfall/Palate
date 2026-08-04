'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { emptyCosting, parseCosting, readDraft, type Costing } from '@/lib/costing'
import { preferredCurrency } from '@/lib/useCosting'

import { CostingEditor, type CalculatorIngredient } from './CostingEditor'

/**
 * Fetch the costing this page is for, then hand it to the editor.
 *
 * Client-side because which costings exist is a question only RLS can answer —
 * yours and your household's. `new` is the unsaved draft, which is how the
 * calculator works with no account at all: everything functions, and only
 * naming and keeping it asks you to sign in.
 *
 * The editor is mounted with the loaded costing as its initial state, so it is
 * keyed on the id — remounting rather than syncing props into state, which is
 * the version of this that silently drops edits.
 */
export function CostingLoader({
  id,
  ingredients,
  detectedCountry,
}: {
  id: string
  ingredients: CalculatorIngredient[]
  /** What the edge thinks, used only when the cook has not chosen a country. */
  detectedCountry: string | null
}) {
  const [costing, setCosting] = useState<Costing | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true

    if (id === 'new') {
      // A draft in progress outranks a blank one — refreshing mid-list should
      // not throw the list away.
      setCosting(readDraft() ?? emptyCosting(preferredCurrency(detectedCountry)))
      return
    }

    void (async () => {
      const { supabaseBrowser } = await import('@/lib/supabase/client')
      const supabase = supabaseBrowser()
      if (!supabase) {
        if (live) setMissing(true)
        return
      }
      const { data, error } = await supabase
        .from('costings')
        .select('id,name,servings,currency,items,source_recipe_slug')
        .eq('id', id)
        .maybeSingle()
      if (!live) return
      const parsed = data ? parseCosting(data) : null
      if (error || !parsed) setMissing(true)
      else setCosting(parsed)
    })()

    return () => {
      live = false
    }
  }, [id, detectedCountry])

  if (missing) {
    return (
      <div className="mt-8 rounded border border-rule bg-wash p-6">
        <p className="m-0 max-w-[52ch] text-slate">
          That costing is not here. It may have been deleted, or it may belong to someone else.
        </p>
        <Link href="/calculator" className="btn-primary mt-5 inline-flex">
          Your costings
        </Link>
      </div>
    )
  }

  if (!costing) return <div className="skeleton mt-8 h-72 w-full" aria-hidden="true" />

  return <CostingEditor key={costing.id ?? 'new'} initial={costing} ingredients={ingredients} />
}
