'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { emptyCosting, writeDraft, type CostingItem } from '@/lib/costing'
import { preferredCurrency } from '@/lib/useCosting'

/**
 * Start a costing from this recipe.
 *
 * The moment the recipes and the calculator stop being separate features. The
 * recipe supplies what a dish is made of and how much of each; the cook
 * supplies what they paid — which is the half we cannot know and the half that
 * makes the number theirs.
 *
 * It writes a draft and navigates rather than inserting a row, so it works
 * signed out. Signing in later turns the draft into a saved costing; nothing is
 * lost in between.
 */

export type SeedRow = {
  label: string
  slug: string | null
  useAmount: string | null
  useUnit: string | null
}

export function CostThisRecipe({
  title,
  servings,
  recipeSlug,
  rows,
}: {
  title: string
  servings: number
  recipeSlug: string
  rows: SeedRow[]
}) {
  const router = useRouter()
  const [going, setGoing] = useState(false)

  if (rows.length === 0) return null

  function start() {
    setGoing(true)
    const items: CostingItem[] = rows.map((r) => ({
      label: r.label,
      slug: r.slug,
      // Left empty on purpose. The prices come from the cook's own book, or
      // from our estimate as a suggestion, once the editor mounts — seeding
      // them here would bake today's numbers into the draft and bypass the
      // "whose number is this" distinction the row is built around.
      priceMinor: null,
      packAmount: null,
      packUnit: null,
      useAmount: r.useAmount,
      useUnit: r.useUnit,
    }))

    writeDraft({
      ...emptyCosting(preferredCurrency()),
      name: title,
      servings: servings > 0 ? servings : 4,
      sourceRecipeSlug: recipeSlug,
      items,
    })
    router.push('/calculator/new')
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={going}
      className="mt-3 cursor-pointer rounded border border-rule bg-transparent px-3 py-2 font-mono text-caption tracking-[0.06em] text-ink uppercase transition-colors hover:border-ink disabled:opacity-60"
    >
      {going ? 'Opening…' : 'Cost this yourself'}
    </button>
  )
}
