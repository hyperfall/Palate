'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { formatMeasure } from '@/lib/measure'
import { useServings } from '@/lib/useServings'
import { useUnitSystem } from '@/lib/useUnitSystem'
import { groupSubstitutions, type SubRow } from '@/lib/substitutions'
import { SubstitutionPopover } from './SubstitutionPopover'

/**
 * Ingredients with a servings scaler — a control that earns its JavaScript.
 * Quantities scale in place; anything non-numeric ("a large handful") is left
 * exactly as written, because pretending to scale it would be a lie.
 *
 * Typeset as ticket lines: item, dotted leader, measure — the measure on the
 * right so the column of numbers stays scannable mid-cook.
 */

type CanonicalIngredient = {
  /** Present once the row is linked to the canonical backbone — the ingredient page's address. */
  slug?: string | null
  name?: string | null
  countable?: boolean | null
  substitutions?: SubRow[] | null
}

type Ingredient = {
  id?: string | null
  quantity?: string | null
  unit?: string | null
  item: string
  note?: string | null
  heading?: boolean | null
  ingredient?: CanonicalIngredient | number | null
}

export function IngredientsPanel({
  ingredients,
  baseServings,
  slug,
}: {
  ingredients: Ingredient[]
  baseServings: number
  /** Scopes the shared servings value so cook mode reads the same number. */
  slug: string
}) {
  // Shared rather than local: cook mode renders the same list, and a scaled
  // quantity that disagrees between the two would be worse than none.
  const [servings, setServings] = useServings(slug, baseServings)
  const factor = servings / baseServings
  const [unitSystem, setUnitSystem] = useUnitSystem()

  // Shared with cook mode's list via lib/measure, so the two can never drift.
  const measureFor = useCallback(
    (ing: Ingredient): string => formatMeasure(ing, { factor, unitSystem }),
    [factor, unitSystem],
  )

  // Editable value buffer — click the number and type "12" instead of tapping
  // + ten times. Focused shows the raw number; committing clamps to 1–24.
  const [servingsBuf, setServingsBuf] = useState(String(baseServings))
  useEffect(() => setServingsBuf(String(servings)), [servings])
  const commitServings = () => {
    const n = Number.parseInt(servingsBuf, 10)
    const v = Number.isNaN(n) ? servings : Math.max(1, Math.min(24, n))
    setServingsBuf(String(v))
    if (v !== servings) setServings(v)
  }

  // ?servings=8 pre-scales on arrival (party links from /students). Read after
  // mount so the statically generated page hydrates cleanly.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('servings')
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN
    if (!Number.isNaN(n)) setServings(Math.max(1, Math.min(24, n)))
  }, [])

  return (
    <div className="border-t-2 border-ink pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.5rem]">Ingredients</h2>

        <div
          className="flex items-center gap-1 rounded border border-rule p-0.5"
          role="group"
          aria-label="Adjust servings"
        >
          <button
            type="button"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            disabled={servings <= 1}
            aria-label="Fewer servings"
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-sm border-none bg-transparent font-mono text-base text-ink transition-colors hover:bg-wash disabled:cursor-default disabled:text-rule"
          >
            −
          </button>
          <span className="inline-flex min-w-[5rem] items-baseline justify-center gap-1 font-mono text-[0.8125rem] font-semibold tabular-nums">
            <input
              type="text"
              inputMode="numeric"
              aria-label="Servings"
              value={servingsBuf}
              onChange={(e) => setServingsBuf(e.target.value.replace(/[^0-9]/g, ''))}
              onFocus={(e) => {
                const el = e.currentTarget
                requestAnimationFrame(() => el.select())
              }}
              onBlur={commitServings}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setServings((s) => Math.min(24, s + 1))
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setServings((s) => Math.max(1, s - 1))
                }
              }}
              className="w-6 bg-transparent text-right tabular-nums text-ink focus:text-flame focus:outline-none"
            />
            <span aria-hidden="true">{servings === 1 ? 'serving' : 'servings'}</span>
          </span>
          <button
            type="button"
            onClick={() => setServings((s) => Math.min(24, s + 1))}
            disabled={servings >= 24}
            aria-label="More servings"
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-sm border-none bg-transparent font-mono text-base text-ink transition-colors hover:bg-wash disabled:cursor-default disabled:text-rule"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-0.5 rounded border border-rule p-0.5" role="group" aria-label="Units">
          {(['metric', 'us'] as const).map((sys) => (
            <button
              key={sys}
              type="button"
              onClick={() => setUnitSystem(sys)}
              aria-pressed={unitSystem === sys}
              className={`cursor-pointer rounded-sm border-none px-2.5 py-1.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.08em] transition-colors ${
                unitSystem === sys ? 'bg-flame text-paper' : 'bg-transparent text-slate hover:text-ink'
              }`}
            >
              {sys === 'metric' ? 'Metric' : 'US'}
            </button>
          ))}
        </div>
      </div>

      {servings !== baseServings && (
        <p className="eyebrow mt-2">
          Scaled from {baseServings} —{' '}
          <button
            type="button"
            onClick={() => setServings(baseServings)}
            className="cursor-pointer border-none bg-transparent p-0 font-inherit text-flame underline underline-offset-2"
          >
            reset
          </button>
        </p>
      )}

      {factor >= 2 && (
        <p className="mt-1.5 text-[0.8125rem] leading-snug text-slate">
          At {Math.round(factor * 10) / 10}×, use a wider pan and expect a little extra cooking time —
          scaled amounts are a starting point, taste as you go.
        </p>
      )}

      <ul className="mt-5 list-none space-y-3 p-0">
        {ingredients.map((ingredient, index) => {
          const measure = measureFor(ingredient)

          // A section label ("To serve") is a heading, not a line item — a
          // dotted leader on it promises a measure that will never come.
          if (ingredient.heading) {
            return (
              <li
                key={ingredient.id ?? index}
                className="eyebrow pt-3 first:pt-0 text-ink"
              >
                {ingredient.item}
              </li>
            )
          }

          return (
            <li key={ingredient.id ?? index} className="leader text-[1.0625rem] leading-snug">
              {(() => {
                const canonical =
                  ingredient.ingredient && typeof ingredient.ingredient === 'object' ? ingredient.ingredient : null
                const subs = canonical?.substitutions ?? []
                return (
                  <span>
                    {groupSubstitutions(subs).length > 0 ? (
                      <SubstitutionPopover
                        item={ingredient.item}
                        substitutions={subs}
                        canonicalSlug={canonical?.slug}
                        canonicalName={canonical?.name}
                      />
                    ) : canonical?.slug ? (
                      // No swaps to offer, so the name itself leads to the
                      // ingredient's page. A plain link, unlike the dotted
                      // popover trigger, so the two never look interchangeable —
                      // and unlike the popover it is there for crawlers too.
                      <Link
                        href={`/ingredients/${canonical.slug}`}
                        className="text-ink no-underline hover:text-flame hover:underline hover:underline-offset-4"
                      >
                        {ingredient.item}
                      </Link>
                    ) : (
                      ingredient.item
                    )}
                    {ingredient.note ? <span className="text-slate">, {ingredient.note}</span> : null}
                  </span>
                )
              })()}
              {/* The dotted leader is a promise of a measure — draw it only when
                  one is coming, or "spicy salsa" trails dots into empty space. */}
              {measure ? (
                <>
                  <span className="leader__dots" aria-hidden="true" />
                  <span className="datum shrink-0">{measure}</span>
                </>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
