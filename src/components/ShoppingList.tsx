'use client'

import Link from 'next/link'
import { useState } from 'react'

import { slugify } from '@/fields/slug'

import { Disclosure } from '@/components/Disclosure'
import type { ShoppingLine, WeekShoppingList } from '@/lib/mealPlan'
import { supabaseBrowser } from '@/lib/supabase/client'


/** One buy-list line. `onStaple` (interactive plan page only) adds a "have it"
 *  action that marks the ingredient a pantry staple; `showRecipes` prints which
 *  dishes need it (useful in the netted list, noise inside a single dish). */
function LineRow({
  line,
  onStaple,
  busy,
  showRecipes,
}: {
  line: ShoppingLine
  onStaple?: (l: ShoppingLine) => void
  busy?: boolean
  showRecipes?: boolean
}) {
  return (
    <li className="grid gap-0.5 border-b border-rule py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-read">
          {/* You buy a bunch, a recipe wants two sprigs. The ingredient page is
              where the rest of it stops being waste. */}
          {line.slug ? (
            <Link
              href={`/ingredients/${line.slug}`}
              title={`What else uses ${line.name}`}
              className="text-ink no-underline hover:text-flame hover:underline hover:underline-offset-4"
            >
              {line.name}
            </Link>
          ) : (
            line.name
          )}
          {line.amounts.length > 0 && <span className="text-slate"> · {line.amounts.join(' + ')}</span>}
        </span>
        {onStaple && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStaple(line)}
            title="I always have this. Hide it from the list"
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 font-mono text-tag tracking-[0.08em] text-slate uppercase underline-offset-2 hover:text-flame hover:underline disabled:opacity-50"
          >
            have it
          </button>
        )}
      </div>
      {showRecipes && line.recipes.length > 1 && (
        <span className="font-mono text-tag text-slate/70">for {line.recipes.join(', ')}</span>
      )}
    </li>
  )
}

/**
 * The week's shopping list in two views: a netted "Everything to buy" section
 * (overlaps merged, staples droppable) plus one collapsible category per dish
 * showing its full ingredients. Interactive on the plan page (the "have it"
 * staple action re-nets on refresh); read-only on a shared card.
 */
export function ShoppingList({ list, interactive = true }: { list: WeekShoppingList; interactive?: boolean }) {
  const supabase = supabaseBrowser()
  const [busy, setBusy] = useState<string | null>(null)
  // Optimistically hide a line the moment "have it" is tapped — no full-page
  // refresh. Reconciled from the server on the next real navigation.
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const markStaple = async (line: ShoppingLine) => {
    if (!supabase) return
    setBusy(line.key)
    setError(null)
    setRemoved((prev) => new Set(prev).add(line.key))
    try {
      const { error: err } = await supabase
        .from('pantry')
        .upsert(
          { ingredient_slug: slugify(line.name), ingredient_name: line.name, is_staple: true },
          { onConflict: 'user_id,ingredient_slug' },
        )
      if (err) {
        // Restore the line and tell the cook, rather than failing silently.
        setRemoved((prev) => {
          const next = new Set(prev)
          next.delete(line.key)
          return next
        })
        setError(`Couldn’t save “${line.name}” as a staple. Try again.`)
      }
    } finally {
      setBusy(null)
    }
  }

  if (list.dishes.length === 0) {
    return (
      <p className="mt-4 text-note text-slate">
        {interactive ? 'Nothing to buy. Add recipes to your week.' : 'No dishes in this week.'}
      </p>
    )
  }

  const onStaple = interactive ? markStaple : undefined
  const visibleNetted = list.netted.filter((l) => !removed.has(l.key))

  return (
    <div className="mt-4 border-t border-rule">
      {error && (
        <p role="alert" className="mt-2 font-mono text-caption text-heat">
          {error}
        </p>
      )}
      {/* Netted buy-list — collapsed by default: the per-dish sections are the
          working view while planning; this expands when it's shopping time. */}
      <Disclosure
        title={<span className="font-display text-read text-ink">Everything to buy</span>}
        meta={`${visibleNetted.length} ${visibleNetted.length === 1 ? 'item' : 'items'}`}
      >
        {visibleNetted.length === 0 ? (
          <p className="text-note text-slate">All set. Every ingredient is already a staple.</p>
        ) : (
          <ul className="grid list-none gap-0 p-0">
            {visibleNetted.map((line) => (
              <LineRow key={line.key} line={line} onStaple={onStaple} busy={busy === line.key} showRecipes />
            ))}
          </ul>
        )}
      </Disclosure>

      {/* One collapsible category per dish — collapsed by default */}
      {list.dishes.map((dish) => (
        <Disclosure
          key={dish.slug}
          title={
            <span className="flex items-center gap-2.5">
              {dish.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- small same-origin thumb
                <img src={dish.image} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded border border-rule object-cover" />
              ) : (
                <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded border border-dashed border-rule bg-wash text-slate/40">
                  ◵
                </span>
              )}
              <span className="min-w-0 truncate font-display text-read text-ink">{dish.title}</span>
            </span>
          }
          meta={`${dish.lines.length} ${dish.lines.length === 1 ? 'item' : 'items'}`}
        >
          {dish.lines.length === 0 ? (
            <p className="text-note text-slate">No ingredients recorded.</p>
          ) : (
            <ul className="grid list-none gap-0 p-0">
              {dish.lines.map((line) => (
                <LineRow key={line.key} line={line} />
              ))}
            </ul>
          )}
        </Disclosure>
      ))}
    </div>
  )
}
