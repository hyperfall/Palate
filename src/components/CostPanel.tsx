'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { computeCost, type CostRow, type IngredientPrice, type PriceBook } from '@/lib/cost'
import { BASE_CURRENCY, currencyForCountry, formatMoney } from '@/lib/money'
import { readShopCountry, subscribeShopCountry } from '@/lib/shopCountry'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useServings } from '@/lib/useServings'

import { CostThisRecipe } from './calculator/CostThisRecipe'

/**
 * What this recipe costs to cook.
 *
 * A client component on a statically rendered page, deliberately. The baseline
 * prices are public and travel with the page, so the panel has something to
 * show before anything loads; the cook's own prices are fetched from the
 * browser the way the pantry is. Reading auth or geo headers on the server
 * would have personalised this — and opted the whole recipe page out of static
 * rendering to do it.
 *
 * The costs follow the servings stepper, because that is the question people
 * actually ask: not "what does this recipe cost" but "what does it cost to
 * cook this for six". Note the per-serving figure does NOT move — doubling a
 * recipe doubles the shop and the servings together — and showing it holding
 * steady while the total climbs is the honest picture.
 */

export type CostPanelRow = {
  item: string
  quantity: string | null
  unit: string | null
  heading?: boolean
  slug: string | null
  densityGPerMl: number | null
  gramsPerPiece: number | null
  /** The admin-authored shelf price, in BASE_CURRENCY. Null when unpriced. */
  baseline: IngredientPrice | null
}

type Props = {
  slug: string
  /** Names the costing when someone starts one from this recipe. */
  title: string
  baseServings: number
  rows: CostPanelRow[]
}

/** Supabase row shape for the cook's own prices. */
type PriceRow = {
  ingredient_slug: string
  price_minor: number
  currency: string
  pack_amount: number
  pack_unit: string
}

export function CostPanel({ slug, title, baseServings, rows }: Props) {
  const [servings] = useServings(slug, baseServings)
  const [mine, setMine] = useState<PriceBook>(() => new Map())
  const [country, setCountry] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)

  // The country picker lives in the footer and on the plan, so the currency has
  // to follow it rather than being decided once at mount.
  useEffect(() => {
    setCountry(readShopCountry())
    return subscribeShopCountry(setCountry)
  }, [])

  const slugKey = rows
    .map((r) => r.slug ?? '')
    .filter(Boolean)
    .join(',')

  useEffect(() => {
    const supabase = supabaseBrowser()
    if (!supabase) return
    let live = true
    void (async () => {
      const { data: auth } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (!live) return
      if (!auth?.user) {
        setSignedIn(false)
        return
      }
      setSignedIn(true)
      const wanted = slugKey.split(',').filter(Boolean)
      if (wanted.length === 0) return
      // RLS returns this user's rows and their household's; no client-side
      // scoping needed, and none would be trustworthy anyway.
      const { data, error } = await supabase
        .from('ingredient_prices')
        .select('ingredient_slug,price_minor,currency,pack_amount,pack_unit')
        .in('ingredient_slug', wanted)
      if (!live || error || !data) return
      const book: PriceBook = new Map()
      for (const r of data as PriceRow[]) {
        book.set(r.ingredient_slug, {
          priceMinor: r.price_minor,
          currency: String(r.currency).toUpperCase(),
          packAmount: Number(r.pack_amount),
          packUnit: r.pack_unit as IngredientPrice['packUnit'],
        })
      }
      setMine(book)
    })()
    return () => {
      live = false
    }
  }, [slugKey])

  // What to total in: whatever the cook's own prices are already recorded in,
  // otherwise their country's currency. Their own book wins because switching
  // country should not orphan every price they have entered.
  const currency = useMemo(() => {
    const first = [...mine.values()][0]
    if (first) return first.currency
    return country ? currencyForCountry(country) : BASE_CURRENCY
  }, [mine, country])

  const result = useMemo(() => {
    const book: PriceBook = new Map()
    if (currency === BASE_CURRENCY) {
      for (const row of rows) {
        if (row.slug && row.baseline) book.set(row.slug, row.baseline)
      }
    }
    for (const [k, v] of mine) book.set(k, v)

    const costRows: CostRow[] = rows.map((r) => ({
      quantity: r.quantity,
      unit: r.unit,
      item: r.item,
      heading: r.heading,
      ingredient: r.slug
        ? { slug: r.slug, densityGPerMl: r.densityGPerMl, gramsPerPiece: r.gramsPerPiece }
        : null,
    }))
    return computeCost(costRows, baseServings, book, currency)
  }, [rows, mine, currency, baseServings])

  // Nothing priced and nothing to price with: say nothing rather than show an
  // empty ledger.
  if (result.priced === 0 && !signedIn) return null

  const factor = baseServings > 0 ? servings / baseServings : 1
  const scaled = (minor: number) => Math.round(minor * factor)
  const missing = result.quantified - result.priced

  return (
    <div className="mt-8 border-t border-rule pt-5">
      <p className="eyebrow m-0">
        Cost · {servings} {servings === 1 ? 'serving' : 'servings'}
      </p>

      <dl className="mt-3 grid gap-2">
        {result.lines.map((line, i) =>
          line.minor == null ? null : (
            <div key={`${line.item}-${i}`} className="leader">
              <dt className="eyebrow">{line.item}</dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0">{formatMoney(scaled(line.minor), result.currency)}</dd>
            </div>
          ),
        )}
      </dl>

      <div className="mt-3 grid gap-2 border-t border-rule pt-3">
        <div className="leader">
          <dt className="eyebrow font-semibold text-ink">Total</dt>
          <span className="leader__dots" aria-hidden="true" />
          <dd className="datum m-0 font-semibold">
            {formatMoney(scaled(result.totalMinor), result.currency)}
          </dd>
        </div>
        <div className="leader">
          {/* Invariant under the stepper — cooking for six costs six times as
              much and feeds six times as many. Worth showing beside a total
              that does move. */}
          <dt className="eyebrow">A plate</dt>
          <span className="leader__dots" aria-hidden="true" />
          <dd className="datum m-0 text-flame">
            {formatMoney(result.perServingMinor, result.currency)}
          </dd>
        </div>
      </div>

      <CostThisRecipe
        title={title}
        servings={baseServings}
        recipeSlug={slug}
        rows={rows
          .filter((r) => !r.heading && r.quantity)
          .map((r) => ({
            label: r.item,
            slug: r.slug,
            useAmount: r.quantity,
            useUnit: r.unit,
          }))}
      />

      <p className="mt-3 mb-0 text-eyebrow leading-snug text-slate">
        {missing > 0 ? (
          <>
            {missing === 1 ? 'One ingredient has' : `${missing} ingredients have`} no price yet, so
            the total is short of the real one.{' '}
          </>
        ) : (
          <>Estimated from typical shelf prices. </>
        )}
        {signedIn ? (
          <Link href="/calculator" className="text-flame">
            Use what you actually pay
          </Link>
        ) : (
          <Link href="/account" className="text-flame">
            Sign in to price it from your own shop
          </Link>
        )}
        .
      </p>
    </div>
  )
}
