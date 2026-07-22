'use client'

import { useEffect, useState } from 'react'

import { convertMeasure, humanizeQuantity } from '@/lib/units'
import { useUnitSystem } from '@/lib/useUnitSystem'
import type { SubRow } from '@/lib/substitutions'
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
  countable?: boolean | null
  substitutions?: SubRow[] | null
}

type Ingredient = {
  id?: string | null
  quantity?: string | null
  unit?: string | null
  item: string
  note?: string | null
  ingredient?: CanonicalIngredient | number | null
}

export function IngredientsPanel({
  ingredients,
  baseServings,
}: {
  ingredients: Ingredient[]
  baseServings: number
}) {
  const [servings, setServings] = useState(baseServings)
  const factor = servings / baseServings
  const [unitSystem, setUnitSystem] = useUnitSystem()

  const measureFor = (ing: Ingredient): string => {
    const parsed = ing.quantity ? Number.parseFloat(ing.quantity) : Number.NaN
    // Non-numeric ("a handful") is left verbatim — scaling it would be a lie.
    if (Number.isNaN(parsed)) return [ing.quantity, ing.unit].filter(Boolean).join(' ')
    const scaled = parsed * factor
    const canonical = ing.ingredient && typeof ing.ingredient === 'object' ? ing.ingredient : null
    const converted = ing.unit
      ? convertMeasure(scaled, ing.unit, unitSystem)
      : { quantity: scaled, unit: '' }
    const qty = humanizeQuantity(converted.quantity, { countable: Boolean(canonical?.countable) })
    return [qty, converted.unit].filter(Boolean).join(' ')
  }

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
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-sm border-none bg-transparent font-mono text-base text-ink transition-colors hover:bg-wash disabled:cursor-default disabled:text-rule"
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
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-sm border-none bg-transparent font-mono text-base text-ink transition-colors hover:bg-wash disabled:cursor-default disabled:text-rule"
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

          return (
            <li key={ingredient.id ?? index} className="leader text-[1.0625rem] leading-snug">
              {(() => {
                const canonical =
                  ingredient.ingredient && typeof ingredient.ingredient === 'object' ? ingredient.ingredient : null
                const subs = canonical?.substitutions ?? []
                return (
                  <span>
                    {subs.length > 0 ? (
                      <SubstitutionPopover item={ingredient.item} substitutions={subs} />
                    ) : (
                      ingredient.item
                    )}
                    {ingredient.note ? <span className="text-slate">, {ingredient.note}</span> : null}
                  </span>
                )
              })()}
              <span className="leader__dots" aria-hidden="true" />
              {measure ? <span className="datum shrink-0">{measure}</span> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
