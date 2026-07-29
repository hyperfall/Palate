'use client'

import { useServings } from '@/lib/useServings'

/**
 * The servings figure in the recipe's decision line, following the scaler.
 *
 * The hero printed the recipe's original servings while the ingredients panel
 * below it showed quantities for whatever you had scaled to — two numbers on
 * one page disagreeing about how many people you were cooking for. Reads the
 * same shared store the panel writes and cook mode reads.
 */
export function ServesBadge({ slug, base }: { slug: string; base: number }) {
  const [servings] = useServings(slug, base)
  return (
    <span>
      Serves {servings}
      {servings !== base && <span className="text-milk/60"> (scaled)</span>}
    </span>
  )
}
