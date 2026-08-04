'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import type { ThumbImage } from '@/components/IngredientThumb'
import type { IngredientPrice } from '@/lib/cost'
import type { Costing } from '@/lib/costing'
import { useCosting, type CatalogueEntry } from '@/lib/useCosting'

import { CalculatorRow } from './CalculatorRow'
import { CostingTotals } from './CostingTotals'
import { IngredientPicker } from './IngredientPicker'

/**
 * The calculator: a costing, its rows, and what they come to.
 *
 * Composition only. The hook owns state and storage, the row owns one line, the
 * totals own the sidebar — this decides what goes where and nothing else, which
 * is what keeps any of it testable.
 */

export type CalculatorIngredient = {
  slug: string
  name: string
  category: string | null
  image: ThumbImage
  densityGPerMl: number | null
  gramsPerPiece: number | null
  baseline: IngredientPrice | null
}

export function CostingEditor({
  initial,
  ingredients,
}: {
  initial: Costing
  ingredients: CalculatorIngredient[]
}) {
  const catalogue = useMemo(
    () =>
      new Map<string, CatalogueEntry>(
        ingredients.map((i) => [
          i.slug,
          {
            slug: i.slug,
            name: i.name,
            densityGPerMl: i.densityGPerMl,
            gramsPerPiece: i.gramsPerPiece,
            baseline: i.baseline,
          },
        ]),
      ),
    [ingredients],
  )
  const bySlug = useMemo(() => new Map(ingredients.map((i) => [i.slug, i])), [ingredients])

  const c = useCosting({ initial, catalogue })
  const { costing, result } = c

  const taken = useMemo(
    () => new Set(costing.items.map((i) => i.slug).filter((s): s is string => Boolean(s))),
    [costing.items],
  )

  const options = useMemo(
    () =>
      ingredients.map((i) => ({
        slug: i.slug,
        name: i.name,
        category: i.category,
        image: i.image,
        hasPrice: Boolean(i.baseline),
      })),
    [ingredients],
  )

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">What are you costing?</span>
          <input
            value={costing.name}
            onChange={(e) => c.setName(e.target.value)}
            placeholder="Dad's chilli"
            aria-label="Name for this costing"
            className="w-full rounded border border-rule bg-transparent px-3 py-2.5 font-display text-[1.25rem] text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
          />
        </label>

        {costing.sourceRecipeSlug && (
          <p className="mt-2 mb-0 text-eyebrow text-slate">
            Started from{' '}
            <Link href={`/recipes/${costing.sourceRecipeSlug}`} className="text-flame">
              the recipe
            </Link>
            . Correcting a price here does not change the recipe — it changes what you pay.
          </p>
        )}

        <div className="mt-6">
          <IngredientPicker
            options={options}
            taken={taken}
            onPick={c.addCatalogueItem}
            onFreeText={c.addFreeItem}
          />
        </div>

        {costing.items.length === 0 ? (
          <p className="mt-8 max-w-[48ch] text-slate">
            Nothing added yet. Search above — anything in our catalogue comes with a researched
            price and converts between units, and you can type in whatever we do not have.
          </p>
        ) : (
          <ul className="mt-6 list-none p-0">
            {costing.items.map((item, i) => {
              const entry = item.slug ? bySlug.get(item.slug) : null
              const baseline = entry?.baseline
              return (
                <CalculatorRow
                  key={`${item.slug ?? item.label}-${i}`}
                  item={item}
                  currency={costing.currency}
                  cost={result.lines[i]?.minor ?? null}
                  reason={result.lines[i]?.reason}
                  image={entry?.image ?? null}
                  category={entry?.category ?? null}
                  suggestion={
                    baseline && baseline.currency === costing.currency
                      ? {
                          priceMinor: baseline.priceMinor,
                          packAmount: baseline.packAmount,
                          packUnit: baseline.packUnit,
                          label: entry?.name ?? item.label,
                        }
                      : null
                  }
                  remembered={Boolean(item.slug && c.remembered.has(item.slug))}
                  onChange={(patch) => c.updateItem(i, patch)}
                  onCommitPrice={() => void c.rememberPrice(costing.items[i])}
                  onUndoRemember={() => item.slug && void c.undoRemember(item.slug)}
                  onRemove={() => c.removeItem(i)}
                />
              )
            })}
          </ul>
        )}
      </div>

      <CostingTotals
        result={result}
        servings={costing.servings}
        currency={costing.currency}
        saveState={c.saveState}
        signedIn={c.signedIn}
        onServings={c.setServings}
        onCurrency={c.setCurrency}
      />
    </div>
  )
}
