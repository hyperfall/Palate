'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { computeCost, type IngredientPrice, type PriceBook } from './cost'
import {
  clearDraft,
  emptyItem,
  MAX_ITEMS,
  parseCosting,
  readDraft,
  toCostInput,
  withPrice,
  writeDraft,
  type Costing,
  type CostingItem,
} from './costing'
import { currencyForCountry } from './money'
import { readShopCountry } from './shopCountry'
import { supabaseBrowser } from './supabase/client'

/**
 * Everything a costing needs to exist: its contents, where it is stored, and
 * what it comes to.
 *
 * All Supabase access for the calculator lives here, so the row and the totals
 * are pure functions of props and can be tested without a database or a
 * network. It is also the only place that knows a costing might be a saved row
 * OR an anonymous draft in localStorage, which is a distinction the UI should
 * never have to think about.
 */

export type CatalogueEntry = {
  slug: string
  name: string
  densityGPerMl: number | null
  gramsPerPiece: number | null
  baseline: IngredientPrice | null
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'signed-out'

type PriceRow = {
  ingredient_slug: string
  price_minor: number
  currency: string
  pack_amount: number
  pack_unit: string
}

/** Debounce for autosave. Long enough not to write on every keystroke, short
 *  enough that closing the tab shortly after typing keeps the work. */
const AUTOSAVE_MS = 900

export function useCosting({
  initial,
  catalogue,
}: {
  initial: Costing
  catalogue: Map<string, CatalogueEntry>
}) {
  const [costing, setCosting] = useState<Costing>(initial)
  const [signedIn, setSignedIn] = useState(false)
  const [myPrices, setMyPrices] = useState<PriceBook>(() => new Map())
  const [saveState, setSaveState] = useState<SaveState>('idle')
  /** Slugs saved to the price book this session, for the inline undo. */
  const [remembered, setRemembered] = useState<Map<string, IngredientPrice | null>>(new Map())

  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Who is looking, and what have they priced before ─────────────────────
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
      for (const r of data as PriceRow[]) {
        book.set(r.ingredient_slug, {
          priceMinor: r.price_minor,
          currency: String(r.currency).toUpperCase(),
          packAmount: Number(r.pack_amount),
          packUnit: r.pack_unit as IngredientPrice['packUnit'],
        })
      }
      setMyPrices(book)
    })()
    return () => {
      live = false
    }
  }, [])

  /**
   * Fill in prices for rows that arrived without one.
   *
   * A costing seeded from a recipe carries amounts but no prices, and rows can
   * be added before the cook's own prices have finished loading. Without this
   * they sit empty behind a "tap to use" link — which is a tap per ingredient
   * before the dish totals anything, and it made a recipe-costing arrive at
   * zero.
   *
   * Only touches rows that are unset or still marked as OURS. A price the cook
   * entered, or one that came from their own book, is never overwritten — that
   * is the whole distinction the row is built around.
   *
   * Deliberately not routed through `mutate`, so it does not mark the costing
   * dirty: resolving a price is not an edit, and autosaving here would bump a
   * costing to the top of the list merely for being opened.
   */
  useEffect(() => {
    setCosting((c) => {
      let changed = false
      const items = c.items.map((item) => {
        if (!item.slug) return item
        if (item.priceMinor != null && item.priceFrom !== 'ours') return item

        const mine = myPrices.get(item.slug)
        if (mine && mine.currency === c.currency) {
          if (item.priceFrom === 'mine' && item.priceMinor === mine.priceMinor) return item
          changed = true
          return withPrice(item, mine, 'mine')
        }
        if (item.priceMinor != null) return item

        const baseline = catalogue.get(item.slug)?.baseline
        if (!baseline || baseline.currency !== c.currency) return item
        changed = true
        return withPrice(item, baseline, 'ours')
      })
      return changed ? { ...c, items } : c
    })
  }, [myPrices, catalogue])

  // ── What it comes to ─────────────────────────────────────────────────────
  const result = useMemo(() => {
    const { rows, prices } = toCostInput(costing, (slug) => catalogue.get(slug) ?? null)
    return computeCost(rows, costing.servings, prices, costing.currency)
  }, [costing, catalogue])

  // ── Editing ──────────────────────────────────────────────────────────────
  const mutate = useCallback((fn: (c: Costing) => Costing) => {
    dirty.current = true
    setCosting(fn)
  }, [])

  /**
   * The price a new row should start from: what this cook already pays, else
   * our researched estimate, else nothing. Ours only applies when the costing
   * is in the currency ours are recorded in — converting would be inventing.
   */
  const prefillFor = useCallback(
    (slug: string, currency: string): IngredientPrice | null => {
      const mine = myPrices.get(slug)
      if (mine && mine.currency === currency) return mine
      const entry = catalogue.get(slug)
      if (entry?.baseline && entry.baseline.currency === currency) return entry.baseline
      return null
    },
    [myPrices, catalogue],
  )

  const addCatalogueItem = useCallback(
    (slug: string) => {
      const entry = catalogue.get(slug)
      if (!entry) return
      mutate((c) => {
        if (c.items.length >= MAX_ITEMS) return c
        const base = emptyItem(entry.name, slug)
        const price = prefillFor(slug, c.currency)
        return { ...c, items: [...c.items, price ? withPrice(base, price) : base] }
      })
    },
    [catalogue, mutate, prefillFor],
  )

  const addFreeItem = useCallback(
    (label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      mutate((c) =>
        c.items.length >= MAX_ITEMS ? c : { ...c, items: [...c.items, emptyItem(trimmed)] },
      )
    },
    [mutate],
  )

  const updateItem = useCallback(
    (index: number, patch: Partial<CostingItem>) => {
      mutate((c) => ({
        ...c,
        items: c.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
      }))
    },
    [mutate],
  )

  const removeItem = useCallback(
    (index: number) => mutate((c) => ({ ...c, items: c.items.filter((_, i) => i !== index) })),
    [mutate],
  )

  const setName = useCallback((name: string) => mutate((c) => ({ ...c, name })), [mutate])
  const setServings = useCallback(
    (servings: number) =>
      mutate((c) => ({ ...c, servings: Math.max(1, Math.min(100, servings || 1)) })),
    [mutate],
  )
  const setCurrency = useCallback(
    (currency: string) => mutate((c) => ({ ...c, currency })),
    [mutate],
  )

  // ── The price book ───────────────────────────────────────────────────────

  /**
   * Remember a corrected price for next time.
   *
   * Automatic rather than opt-in: the point of the price book is that a
   * correction outlives this sitting and reaches every recipe, and a checkbox
   * nobody finds defeats that. It is safe to be automatic because the costing
   * keeps its own snapshot — undo puts the book back and never touches a saved
   * costing.
   */
  const rememberPrice = useCallback(
    async (item: CostingItem) => {
      const supabase = supabaseBrowser()
      if (!supabase || !signedIn || !item.slug) return
      if (item.priceMinor == null || item.packAmount == null || !item.packUnit) return

      const previous = myPrices.get(item.slug) ?? null
      const next: IngredientPrice = {
        priceMinor: item.priceMinor,
        currency: costing.currency,
        packAmount: item.packAmount,
        packUnit: item.packUnit,
      }
      // Nothing to say if it already matches what they had.
      if (
        previous &&
        previous.priceMinor === next.priceMinor &&
        previous.packAmount === next.packAmount &&
        previous.packUnit === next.packUnit &&
        previous.currency === next.currency
      ) {
        return
      }

      const { error } = await supabase.from('ingredient_prices').upsert(
        {
          ingredient_slug: item.slug,
          ingredient_name: item.label,
          price_minor: next.priceMinor,
          currency: next.currency,
          pack_amount: next.packAmount,
          pack_unit: next.packUnit,
        },
        { onConflict: 'user_id,ingredient_slug' },
      )
      if (error) return
      setMyPrices((m) => new Map(m).set(item.slug!, next))
      setRemembered((r) => new Map(r).set(item.slug!, previous))
    },
    [signedIn, myPrices, costing.currency],
  )

  const undoRemember = useCallback(
    async (slug: string) => {
      const supabase = supabaseBrowser()
      if (!supabase) return
      const previous = remembered.get(slug)
      if (previous) {
        await supabase.from('ingredient_prices').upsert(
          {
            ingredient_slug: slug,
            ingredient_name: slug,
            price_minor: previous.priceMinor,
            currency: previous.currency,
            pack_amount: previous.packAmount,
            pack_unit: previous.packUnit,
          },
          { onConflict: 'user_id,ingredient_slug' },
        )
        setMyPrices((m) => new Map(m).set(slug, previous))
      } else {
        await supabase.from('ingredient_prices').delete().eq('ingredient_slug', slug)
        setMyPrices((m) => {
          const next = new Map(m)
          next.delete(slug)
          return next
        })
      }
      setRemembered((r) => {
        const next = new Map(r)
        next.delete(slug)
        return next
      })
    },
    [remembered],
  )

  // ── Persistence ──────────────────────────────────────────────────────────

  const persist = useCallback(async (): Promise<string | null> => {
    const supabase = supabaseBrowser()
    // No account: the working list still survives a refresh, but there is
    // nothing to name and nothing to share.
    if (!supabase || !signedIn) {
      writeDraft(costing)
      setSaveState('signed-out')
      return null
    }

    setSaveState('saving')
    const row = {
      name: costing.name.trim() || 'Untitled costing',
      servings: costing.servings,
      currency: costing.currency,
      items: costing.items,
      source_recipe_slug: costing.sourceRecipeSlug,
    }

    if (costing.id) {
      const { error } = await supabase.from('costings').update(row).eq('id', costing.id)
      setSaveState(error ? 'error' : 'saved')
      return error ? null : costing.id
    }

    const { data, error } = await supabase.from('costings').insert(row).select('id').single()
    if (error || !data) {
      setSaveState('error')
      return null
    }
    const id = String((data as { id: string }).id)
    setCosting((c) => ({ ...c, id }))
    // The draft has become a real costing; leaving it behind would resurrect
    // itself as a second copy on the next visit.
    clearDraft()
    setSaveState('saved')
    return id
  }, [costing, signedIn])

  // Autosave. Only after an actual edit — mounting must not write, or opening
  // a costing to look at it would bump it to the top of the list.
  useEffect(() => {
    if (!dirty.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      void persist()
    }, AUTOSAVE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [costing, persist])

  return {
    costing,
    result,
    signedIn,
    myPrices,
    remembered,
    saveState,
    addCatalogueItem,
    addFreeItem,
    updateItem,
    removeItem,
    setName,
    setServings,
    setCurrency,
    rememberPrice,
    undoRemember,
    save: persist,
  }
}

/** Read the anonymous draft, for a page that has no saved costing to open. */
export function loadDraftOrEmpty(fallback: Costing): Costing {
  if (typeof window === 'undefined') return fallback
  return readDraft() ?? fallback
}

/** Parse a Supabase row into a costing. Exported for the list and the page. */
export function costingFromRow(row: unknown): Costing | null {
  return parseCosting(row)
}

/** Read the country's currency for a brand-new costing. */
export function preferredCurrency(): string {
  if (typeof window === 'undefined') return currencyForCountry(null)
  return currencyForCountry(readShopCountry())
}
