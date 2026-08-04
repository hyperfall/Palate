'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Select } from '@/components/controls'
import { IngredientThumb, type ThumbImage } from '@/components/IngredientThumb'
import { computeCost, type CostRow, type IngredientPrice, type PriceBook } from '@/lib/cost'
import { foldText } from '@/lib/fuzzy'
import {
  BASE_CURRENCY,
  currencyForCountry,
  formatMoney,
  minorPerMajor,
  parseMoneyInput,
  supportedCurrencies,
} from '@/lib/money'
import { readShopCountry } from '@/lib/shopCountry'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Cost something out, ingredient by ingredient.
 *
 * This started life as a settings screen — a hundred and nine rows with a price
 * field on each — and that was the wrong shape. Nobody sits down to fill in a
 * price list. They sit down with a dish in mind and want to know what it comes
 * to, and they want to change a price when ours is wrong for their shop. So the
 * list is gone: you add what you are cooking, it totals as you go, and editing
 * a price is something you do to a line in front of you rather than a chore you
 * do first.
 *
 * The prices you correct are saved to your account and shared with your
 * household, so the correction outlives this sitting and shows up on every
 * recipe. The working list itself is kept in the browser — it is a scratchpad,
 * not a document, and it should survive a refresh without becoming something
 * you have to manage.
 */

export type CalculatorIngredient = {
  slug: string
  name: string
  category: string | null
  image: ThumbImage
  /** Needed to convert a recipe's amount to the pack's — without them, "2 tbsp
   *  of oil" and "3 cloves of garlic" quietly stop costing. */
  densityGPerMl: number | null
  gramsPerPiece: number | null
  /** Our estimate, always in BASE_CURRENCY. Null when we have none. */
  baseline: IngredientPrice | null
}

/** A line the cook has added: which ingredient, and how much of it. */
type Line = { slug: string; quantity: string; unit: string }

const STORE_KEY = 'palate:cost-calculator'
const UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', ''] as const
const UNIT_LABEL: Record<string, string> = {
  g: 'g', kg: 'kg', ml: 'ml', l: 'l', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', '': 'each',
}
const PACK_LABEL: Record<string, string> = { g: 'g', ml: 'ml', piece: 'each' }

type PriceRow = {
  ingredient_slug: string
  price_minor: number
  currency: string
  pack_amount: number
  pack_unit: string
}

export function CostCalculator({ ingredients }: { ingredients: CalculatorIngredient[] }) {
  const bySlug = useMemo(
    () => new Map(ingredients.map((i) => [i.slug, i])),
    [ingredients],
  )

  const [lines, setLines] = useState<Line[]>([])
  const [servings, setServings] = useState(4)
  const [query, setQuery] = useState('')
  const [mine, setMine] = useState<PriceBook>(() => new Map())
  const [currency, setCurrency] = useState(BASE_CURRENCY)
  const [signedIn, setSignedIn] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Restore the scratchpad. Reading before the first paint would need
  // useLayoutEffect and a hydration mismatch; a blank first frame is fine here.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { lines?: Line[]; servings?: number }
        if (Array.isArray(saved.lines)) setLines(saved.lines.filter((l) => l && l.slug))
        if (typeof saved.servings === 'number' && saved.servings > 0) setServings(saved.servings)
      }
    } catch {
      /* corrupt or unavailable storage — start empty rather than throw */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ lines, servings }))
    } catch {
      /* private mode — the calculator still works for this sitting */
    }
  }, [lines, servings, loaded])

  useEffect(() => {
    const supabase = supabaseBrowser()
    if (!supabase) return
    let live = true
    void (async () => {
      const { data: auth } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (!live || !auth?.user) return
      setSignedIn(true)
      const { data } = await supabase
        .from('ingredient_prices')
        .select('ingredient_slug,price_minor,currency,pack_amount,pack_unit')
      if (!live || !data) return
      const book: PriceBook = new Map()
      let seen: string | null = null
      for (const r of data as PriceRow[]) {
        const code = String(r.currency).toUpperCase()
        seen ??= code
        book.set(r.ingredient_slug, {
          priceMinor: r.price_minor,
          currency: code,
          packAmount: Number(r.pack_amount),
          packUnit: r.pack_unit as IngredientPrice['packUnit'],
        })
      }
      setMine(book)
      setCurrency(seen ?? currencyForCountry(readShopCountry()))
    })()
    return () => {
      live = false
    }
  }, [])

  /** Baseline under the cook's own prices, exactly as the recipe panel does it. */
  const book = useMemo(() => {
    const merged: PriceBook = new Map()
    if (currency === BASE_CURRENCY) {
      for (const i of ingredients) if (i.baseline) merged.set(i.slug, i.baseline)
    }
    for (const [k, v] of mine) merged.set(k, v)
    return merged
  }, [ingredients, mine, currency])

  const result = useMemo(() => {
    const rows: CostRow[] = lines.map((l) => {
      const ing = bySlug.get(l.slug)
      return {
        quantity: l.quantity,
        unit: l.unit || null,
        item: ing?.name ?? l.slug,
        ingredient: {
          slug: l.slug,
          densityGPerMl: ing?.densityGPerMl ?? null,
          gramsPerPiece: ing?.gramsPerPiece ?? null,
        },
      }
    })
    return computeCost(rows, servings, book, currency)
  }, [lines, servings, book, currency, bySlug])

  const matches = useMemo(() => {
    const q = foldText(query)
    if (!q) return []
    const taken = new Set(lines.map((l) => l.slug))
    return ingredients
      .filter((i) => !taken.has(i.slug) && foldText(i.name).includes(q))
      .slice(0, 8)
  }, [query, ingredients, lines])

  function add(ing: CalculatorIngredient) {
    // Seed the unit from how the ingredient is sold, so the common case needs
    // only a number typed: something sold by the item starts as a count.
    const unit = ing.baseline?.packUnit === 'piece' ? '' : (ing.baseline?.packUnit ?? 'g')
    setLines((l) => [...l, { slug: ing.slug, quantity: '', unit }])
    setQuery('')
    searchRef.current?.focus()
  }

  async function savePrice(slug: string, price: string, amount: string, unit: string) {
    const supabase = supabaseBrowser()
    if (!supabase) return
    const priceMinor = parseMoneyInput(price, currency)
    const packAmount = Number(amount)
    if (priceMinor == null || !Number.isFinite(packAmount) || packAmount <= 0) return
    const ing = bySlug.get(slug)
    await supabase.from('ingredient_prices').upsert(
      {
        ingredient_slug: slug,
        ingredient_name: ing?.name ?? slug,
        price_minor: priceMinor,
        currency,
        pack_amount: packAmount,
        pack_unit: unit,
      },
      { onConflict: 'user_id,ingredient_slug' },
    )
    setMine((m) => {
      const next = new Map(m)
      next.set(slug, {
        priceMinor,
        currency,
        packAmount,
        packUnit: unit as IngredientPrice['packUnit'],
      })
      return next
    })
    setEditing(null)
  }

  const lineCost = (i: number) => result.lines[i]?.minor ?? null
  const reason = (i: number) => result.lines[i]?.reason

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div>
        {/* ── Add ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <label className="flex flex-col gap-1">
            <span className="eyebrow">Add an ingredient</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="tofu, olive oil, chicken thigh…"
              aria-label="Search the ingredient catalogue"
              className="w-full rounded border border-rule bg-transparent px-3 py-2.5 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
            />
          </label>
          {matches.length > 0 && (
            <ul className="absolute top-full left-0 z-30 mt-1.5 w-full list-none overflow-hidden rounded-md border border-ink/25 bg-card p-1.5 shadow-(--shadow-block)">
              {matches.map((m) => (
                <li key={m.slug} className="m-0">
                  <button
                    type="button"
                    onClick={() => add(m)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded p-2 text-left hover:bg-wash"
                  >
                    <IngredientThumb name={m.name} category={m.category} image={m.image} size={30} />
                    <span className="font-body text-[0.95rem] text-ink">{m.name}</span>
                    {!m.baseline && (
                      <span className="ml-auto font-mono text-caption text-slate uppercase">
                        no price
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── The list ────────────────────────────────────────────────── */}
        {lines.length === 0 ? (
          <p className="mt-8 max-w-[46ch] text-slate">
            Nothing added yet. Search above and build up a dish — it totals as you go, and every
            price is one you can correct.
          </p>
        ) : (
          <ul className="mt-6 list-none p-0">
            {lines.map((line, i) => {
              const ing = bySlug.get(line.slug)
              if (!ing) return null
              const cost = lineCost(i)
              const why = reason(i)
              const price = book.get(line.slug)
              const isEditing = editing === line.slug
              return (
                <li key={`${line.slug}-${i}`} className="border-b border-rule py-3">
                  {/* The controls are grouped so they wrap BELOW the name on a
                      narrow screen rather than crushing it. The name column
                      keeps a min-width for the same reason: it shares a row
                      with a select, and a select is content-sized in a way that
                      will happily squeeze a truncating neighbour to nothing. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <IngredientThumb name={ing.name} category={ing.category} image={ing.image} />

                    <div className="min-w-[9rem] flex-1">
                      <p className="m-0 truncate font-body text-[1rem] text-ink">{ing.name}</p>
                      <button
                        type="button"
                        onClick={() => setEditing(isEditing ? null : line.slug)}
                        // Not uppercased: this line is mostly numbers and units,
                        // and "132G" is not a unit anyone writes.
                        className="cursor-pointer border-none bg-transparent p-0 text-left font-mono text-caption text-slate hover:text-flame"
                      >
                        {price
                          ? `${formatMoney(price.priceMinor, price.currency)} / ${price.packAmount}${PACK_LABEL[price.packUnit] ?? price.packUnit}`
                          : 'set a price'}
                        {mine.has(line.slug) ? ' · yours' : ''}
                      </button>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <input
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((l) =>
                            l.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)),
                          )
                        }
                        placeholder="0"
                        aria-label={`How much ${ing.name}`}
                        className="w-16 rounded border border-rule bg-transparent px-2 py-1.5 text-right font-mono text-detail text-ink focus:border-flame focus:outline-none"
                      />

                      {/* Select is w-full by house style, so it needs a sized
                          box around it or it takes the whole row. */}
                      <div className="w-24 shrink-0">
                        <Select
                          value={line.unit}
                          onChange={(v) =>
                            setLines((l) => l.map((x, j) => (j === i ? { ...x, unit: v } : x)))
                          }
                          ariaLabel={`Unit for ${ing.name}`}
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {UNIT_LABEL[u]}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <span className="datum w-20 shrink-0 text-right">
                        {cost != null ? (
                          formatMoney(cost, result.currency)
                        ) : (
                          <span
                            className="font-mono text-caption text-slate uppercase"
                            title={
                              why === 'no-price'
                                ? 'No price recorded for this ingredient'
                                : why === 'no-amount'
                                  ? 'Type an amount'
                                  : why === 'wrong-currency'
                                    ? `Your price for this is not in ${result.currency}`
                                    : 'This amount cannot be converted to the pack size'
                            }
                          >
                            {why === 'no-amount' ? '—' : '?'}
                          </span>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => setLines((l) => l.filter((_, j) => j !== i))}
                        aria-label={`Remove ${ing.name}`}
                        className="shrink-0 cursor-pointer border-none bg-transparent p-1 text-slate hover:text-heat"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <PriceEditor
                      currency={currency}
                      current={price ?? null}
                      signedIn={signedIn}
                      onCancel={() => setEditing(null)}
                      onSave={(p, a, u) => void savePrice(line.slug, p, a, u)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── The total ─────────────────────────────────────────────────── */}
      <aside className="rounded border border-rule bg-wash p-5 lg:sticky lg:top-24">
        <p className="eyebrow m-0">What it comes to</p>

        <div className="mt-4 grid gap-2">
          <div className="leader">
            <dt className="eyebrow font-semibold text-ink">Total</dt>
            <span className="leader__dots" aria-hidden="true" />
            <dd className="datum m-0 font-semibold">
              {formatMoney(result.totalMinor, result.currency)}
            </dd>
          </div>
          <div className="leader">
            <dt className="eyebrow">A plate</dt>
            <span className="leader__dots" aria-hidden="true" />
            <dd className="datum m-0 text-flame">
              {formatMoney(result.perServingMinor, result.currency)}
            </dd>
          </div>
        </div>

        <label className="mt-5 flex items-center justify-between gap-3 border-t border-rule pt-4">
          <span className="eyebrow">Serves</span>
          <input
            type="number"
            min={1}
            max={50}
            value={servings}
            onChange={(e) => setServings(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-20 rounded border border-rule bg-transparent px-2 py-1.5 text-right font-mono text-detail text-ink focus:border-flame focus:outline-none"
          />
        </label>

        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="eyebrow">Currency</span>
          <div className="w-28 shrink-0">
            <Select value={currency} onChange={setCurrency} ariaLabel="Currency">
              {supportedCurrencies().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </label>

        {result.quantified > result.priced && (
          <p className="mt-4 mb-0 text-eyebrow leading-snug text-slate">
            {result.quantified - result.priced} of {result.quantified} priced. The total is short of
            the real one until the rest have prices.
          </p>
        )}

        {currency !== BASE_CURRENCY && (
          <p className="mt-3 mb-0 text-eyebrow leading-snug text-slate">
            Our estimates are in {BASE_CURRENCY} and are never converted — a rate we invented would
            be worse than a gap. In {currency}, only prices you enter count.
          </p>
        )}

        {!signedIn && (
          <p className="mt-4 mb-0 text-eyebrow leading-snug text-slate">
            <Link href="/account" className="text-flame">
              Sign in
            </Link>{' '}
            to keep the prices you correct — they follow you onto every recipe, and are shared with
            your household.
          </p>
        )}
      </aside>
    </div>
  )
}

/** The inline "what do you pay for this" form, opened from a line. */
function PriceEditor({
  currency,
  current,
  signedIn,
  onSave,
  onCancel,
}: {
  currency: string
  current: IngredientPrice | null
  signedIn: boolean
  onSave: (price: string, amount: string, unit: string) => void
  onCancel: () => void
}) {
  const digits = minorPerMajor(currency) === 1 ? 0 : 2
  const [price, setPrice] = useState(
    current ? (current.priceMinor / minorPerMajor(currency)).toFixed(digits) : '',
  )
  const [amount, setAmount] = useState(current ? String(current.packAmount) : '')
  const [unit, setUnit] = useState(current?.packUnit ?? 'g')

  return (
    <div className="mt-3 ml-[3.5rem] rounded border border-rule bg-wash p-3">
      <p className="m-0 text-eyebrow text-slate">
        What do you pay, and for how much? “{formatMoney(250, currency)} for 500 g” is a price of{' '}
        {formatMoney(250, currency)} and a pack of 500 g.
      </p>
      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Price</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={currency}
            className="w-24 rounded border border-rule bg-transparent px-2 py-1.5 text-right font-mono text-detail text-ink focus:border-flame focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">For</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
            className="w-24 rounded border border-rule bg-transparent px-2 py-1.5 text-right font-mono text-detail text-ink focus:border-flame focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Unit</span>
          <div className="w-24">
            <Select
              value={unit}
              onChange={(v) => setUnit(v as IngredientPrice['packUnit'])}
              ariaLabel="Pack unit"
            >
              <option value="g">grams</option>
              <option value="ml">ml</option>
              <option value="piece">each</option>
            </Select>
          </div>
        </label>
        <button
          type="button"
          onClick={() => onSave(price, amount, unit)}
          disabled={!signedIn}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-rule px-3 py-2 font-mono text-detail tracking-[0.08em] text-ink uppercase hover:border-ink"
        >
          Cancel
        </button>
      </div>
      {!signedIn && (
        <p className="mt-2 mb-0 text-eyebrow text-slate">
          Prices are saved to your account — sign in to keep this one.
        </p>
      )}
    </div>
  )
}
