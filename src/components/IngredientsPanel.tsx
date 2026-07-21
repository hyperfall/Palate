'use client'

import { useEffect, useState } from 'react'

/**
 * Ingredients with a servings scaler — a control that earns its JavaScript.
 * Quantities scale in place; anything non-numeric ("a large handful") is left
 * exactly as written, because pretending to scale it would be a lie.
 *
 * Typeset as ticket lines: item, dotted leader, measure — the measure on the
 * right so the column of numbers stays scannable mid-cook.
 */

type Ingredient = {
  id?: string | null
  quantity?: string | null
  unit?: string | null
  item: string
  note?: string | null
}

const VULGAR: Array<[number, string]> = [
  [0.25, '¼'],
  [0.33, '⅓'],
  [0.5, '½'],
  [0.67, '⅔'],
  [0.75, '¾'],
]

function formatQuantity(value: number): string {
  const whole = Math.floor(value)
  const frac = value - whole

  for (const [v, glyph] of VULGAR) {
    if (Math.abs(frac - v) < 0.05) return whole > 0 ? `${whole}${glyph}` : glyph
  }
  if (frac < 0.05) return String(whole)
  return String(Math.round(value * 100) / 100)
}

function scaleQuantity(quantity: string | null | undefined, factor: number): string {
  if (!quantity) return ''
  const parsed = Number.parseFloat(quantity)
  if (Number.isNaN(parsed)) return quantity
  return formatQuantity(parsed * factor)
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

      <ul className="mt-5 list-none space-y-3 p-0">
        {ingredients.map((ingredient, index) => {
          const measure = [scaleQuantity(ingredient.quantity, factor), ingredient.unit]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={ingredient.id ?? index} className="leader text-[1.0625rem] leading-snug">
              <span>
                {ingredient.item}
                {ingredient.note ? <span className="text-slate">, {ingredient.note}</span> : null}
              </span>
              <span className="leader__dots" aria-hidden="true" />
              {measure ? <span className="datum shrink-0">{measure}</span> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
