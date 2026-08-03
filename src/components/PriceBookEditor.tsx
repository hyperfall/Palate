'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Select } from '@/components/controls'
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
 * The price book: what this cook actually pays.
 *
 * The whole cost feature rests on this page, so it is built around the two
 * things that make a price list get filled in rather than abandoned. It shows
 * our baseline beside each field, so a row is a correction rather than a blank
 * — most people will only change the dozen things they buy often, and the rest
 * can stay as the estimate. And it saves on blur, one row at a time, because a
 * hundred-row form behind a single Save button is a hundred rows of work you
 * can lose.
 *
 * Prices are shared with a household by the database, not by this component:
 * the trigger stamps household_id on write and RLS returns a partner's rows on
 * read. Two people shopping from one kitchen see one set of numbers.
 */

export type PriceBookIngredient = {
  slug: string
  name: string
  category: string | null
  /** Our estimate, always in BASE_CURRENCY. Null when we have none. */
  baseline: { priceMinor: number; packAmount: number; packUnit: string } | null
}

type Draft = {
  price: string
  packAmount: string
  packUnit: 'g' | 'ml' | 'piece'
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const UNIT_LABEL: Record<string, string> = { g: 'g', ml: 'ml', piece: 'each' }

export function PriceBookEditor({ ingredients }: { ingredients: PriceBookIngredient[] }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [currency, setCurrency] = useState(BASE_CURRENCY)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saved, setSaved] = useState<Record<string, SaveState>>({})
  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const mineRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = supabaseBrowser()
    if (!supabase) {
      setReady(true)
      return
    }
    let live = true
    void (async () => {
      const { data: auth } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (!live) return
      if (!auth?.user) {
        setReady(true)
        return
      }
      setSignedIn(true)
      const { data } = await supabase
        .from('ingredient_prices')
        .select('ingredient_slug,price_minor,currency,pack_amount,pack_unit')
      if (!live) return
      const next: Record<string, Draft> = {}
      let seen: string | null = null
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const slug = String(r.ingredient_slug)
        const code = String(r.currency).toUpperCase()
        seen ??= code
        mineRef.current.add(slug)
        next[slug] = {
          price: (Number(r.price_minor) / minorPerMajor(code)).toFixed(
            minorPerMajor(code) === 1 ? 0 : 2,
          ),
          packAmount: String(Number(r.pack_amount)),
          packUnit: String(r.pack_unit) as Draft['packUnit'],
        }
      }
      // Their existing prices decide the currency; only fall back to the
      // country picker when the book is empty. Switching country should not
      // silently re-denominate prices they already entered.
      setCurrency(seen ?? currencyForCountry(readShopCountry()))
      setDrafts(next)
      setReady(true)
    })()
    return () => {
      live = false
    }
  }, [])

  const rows = useMemo(() => {
    const q = foldText(query)
    let list = ingredients
    if (onlyMine) list = list.filter((i) => mineRef.current.has(i.slug))
    if (!q) return list
    return list.filter((i) => foldText(i.name).includes(q) || foldText(i.slug).includes(q))
  }, [ingredients, query, onlyMine, drafts])

  const mark = (slug: string, state: SaveState) =>
    setSaved((s) => ({ ...s, [slug]: state }))

  async function persist(ing: PriceBookIngredient) {
    const supabase = supabaseBrowser()
    const draft = drafts[ing.slug]
    if (!supabase || !draft) return

    const priceMinor = parseMoneyInput(draft.price, currency)
    const packAmount = Number(draft.packAmount)

    // An emptied row means "forget my price and go back to the estimate",
    // which is a delete rather than a zero — storing 0 would claim the
    // ingredient is free.
    if (draft.price.trim() === '') {
      mark(ing.slug, 'saving')
      const { error } = await supabase
        .from('ingredient_prices')
        .delete()
        .eq('ingredient_slug', ing.slug)
      mineRef.current.delete(ing.slug)
      mark(ing.slug, error ? 'error' : 'idle')
      return
    }

    if (priceMinor == null || !Number.isFinite(packAmount) || packAmount <= 0) {
      mark(ing.slug, 'error')
      return
    }

    mark(ing.slug, 'saving')
    const { error } = await supabase.from('ingredient_prices').upsert(
      {
        ingredient_slug: ing.slug,
        ingredient_name: ing.name,
        price_minor: priceMinor,
        currency,
        pack_amount: packAmount,
        pack_unit: draft.packUnit,
      },
      { onConflict: 'user_id,ingredient_slug' },
    )
    if (!error) mineRef.current.add(ing.slug)
    mark(ing.slug, error ? 'error' : 'saved')
  }

  function edit(slug: string, patch: Partial<Draft>, ing: PriceBookIngredient) {
    setDrafts((d) => {
      const current: Draft = d[slug] ?? {
        price: '',
        packAmount: ing.baseline ? String(ing.baseline.packAmount) : '',
        packUnit: (ing.baseline?.packUnit as Draft['packUnit']) ?? 'g',
      }
      return { ...d, [slug]: { ...current, ...patch } }
    })
    mark(slug, 'idle')
  }

  if (!ready) {
    return <div className="skeleton mt-8 h-64 w-full" aria-hidden="true" />
  }

  if (!signedIn) {
    return (
      <div className="mt-8 rounded border border-rule bg-wash p-6">
        <p className="m-0 max-w-[52ch] text-slate">
          A price book is tied to your account, and shared with your household if you are in one.
          Sign in and every recipe starts costing itself from what you actually pay rather than our
          estimate.
        </p>
        <Link href="/account" className="btn-primary mt-5 inline-flex">
          Sign in
        </Link>
      </div>
    )
  }

  const mineCount = mineRef.current.size

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-4 border-b border-rule pb-4">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Currency</span>
          <Select value={currency} onChange={setCurrency} ariaLabel="Price book currency">
            {supportedCurrencies().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <span className="eyebrow">Find an ingredient</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="tofu, olive oil, eggs…"
            className="w-full rounded border border-rule bg-transparent px-3 py-2 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => setOnlyMine((v) => !v)}
          aria-pressed={onlyMine}
          className="rounded border border-rule px-4 py-2.5 font-mono text-detail tracking-[0.08em] text-ink uppercase transition-colors hover:border-ink aria-pressed:border-flame aria-pressed:text-flame"
        >
          Mine ({mineCount})
        </button>
      </div>

      {currency !== BASE_CURRENCY && (
        <p className="mt-4 rounded border border-rule bg-wash px-3 py-2 text-detail text-slate">
          Our estimates are in {BASE_CURRENCY} and are not converted — a rate we invented would be
          worse than a gap. In {currency}, a recipe is costed only from prices you enter here.
        </p>
      )}

      <ul className="mt-2 list-none p-0">
        {rows.map((ing) => {
          const draft = drafts[ing.slug]
          const state = saved[ing.slug] ?? 'idle'
          const hasMine = Boolean(draft?.price?.trim())
          return (
            <li
              key={ing.slug}
              className="grid grid-cols-1 items-center gap-3 border-b border-rule py-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_7rem_5rem]"
            >
              <div className="min-w-0">
                <p className="m-0 truncate font-body text-[1rem] text-ink">{ing.name}</p>
                <p className="m-0 text-eyebrow text-slate">
                  {ing.baseline && currency === BASE_CURRENCY ? (
                    <>
                      estimate {formatMoney(ing.baseline.priceMinor, BASE_CURRENCY)} /{' '}
                      {ing.baseline.packAmount}
                      {UNIT_LABEL[ing.baseline.packUnit] ?? ing.baseline.packUnit}
                    </>
                  ) : (
                    <>no estimate</>
                  )}
                </p>
              </div>

              <label className="contents">
                <span className="sr-only">{`Price you pay for ${ing.name}`}</span>
                <input
                  inputMode="decimal"
                  value={draft?.price ?? ''}
                  onChange={(e) => edit(ing.slug, { price: e.target.value }, ing)}
                  onBlur={() => void persist(ing)}
                  placeholder={currency}
                  aria-label={`Price you pay for ${ing.name}`}
                  className="w-full rounded border border-rule bg-transparent px-2.5 py-1.5 text-right font-mono text-detail text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
                />
              </label>

              <input
                inputMode="decimal"
                value={draft?.packAmount ?? (ing.baseline ? String(ing.baseline.packAmount) : '')}
                onChange={(e) => edit(ing.slug, { packAmount: e.target.value }, ing)}
                onBlur={() => hasMine && void persist(ing)}
                aria-label={`Pack size for ${ing.name}`}
                className="w-full rounded border border-rule bg-transparent px-2.5 py-1.5 text-right font-mono text-detail text-ink focus:border-flame focus:outline-none"
              />

              <Select
                value={draft?.packUnit ?? (ing.baseline?.packUnit ?? 'g')}
                onChange={(v) => {
                  edit(ing.slug, { packUnit: v as Draft['packUnit'] }, ing)
                }}
                ariaLabel={`Pack unit for ${ing.name}`}
              >
                <option value="g">grams</option>
                <option value="ml">ml</option>
                <option value="piece">each</option>
              </Select>

              <span
                aria-live="polite"
                className={`font-mono text-caption tracking-[0.08em] uppercase ${
                  state === 'error' ? 'text-heat' : 'text-slate'
                }`}
              >
                {state === 'saving' && 'saving'}
                {state === 'saved' && 'saved'}
                {state === 'error' && 'check it'}
              </span>
            </li>
          )
        })}
      </ul>

      {rows.length === 0 && (
        <p className="mt-6 text-slate">
          {onlyMine
            ? 'You have not priced anything yet. Turn this filter off and start with what you buy most.'
            : `Nothing matching “${query}”.`}
        </p>
      )}
    </div>
  )
}
