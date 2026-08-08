import type { CostRow, IngredientPrice, PriceBook } from './cost'
import { BASE_CURRENCY, isSupportedCurrency, MAX_MINOR } from './money'

/**
 * A costing: a named list of what a dish is made of, what was paid for each
 * thing, and how much of it the dish uses.
 *
 * The type that matters here is the item, and the thing to understand about it
 * is that it carries its own price. A costing is a record of a purchase, not a
 * live query against the price book — update your mince price in June and
 * March's chilli must still show what March cost. The price book prefills a new
 * row; it never reaches back into a saved one.
 *
 * Everything in this file is pure. Loading and saving live in the hook; parsing
 * and validating live here so they can be tested without a database, and so a
 * corrupt row out of JSONB or localStorage cannot take a page down.
 */

/** One line of a costing. */
export type CostingItem = {
  /** What the row is called. Always present, even for catalogue rows, so a
   *  costing still reads correctly if an ingredient is later renamed. */
  label: string
  /** The catalogue ingredient, or null for something typed freehand. */
  slug: string | null
  /** What was paid, in minor units of the costing's currency. */
  priceMinor: number | null
  /** How much that bought. */
  packAmount: number | null
  packUnit: 'g' | 'ml' | 'piece' | null
  /**
   * How much the dish uses. A string, unlike packAmount, because this is how a
   * recipe is written — "1/2", "1½", "300" — and parseQuantity already reads
   * all of those. Storing it as a number would mean parsing at entry and
   * losing what the cook typed.
   */
  useAmount: string | null
  useUnit: string | null
  /**
   * Whose number the price is.
   *
   * The point of prefilling our estimate is that a ten-ingredient dish should
   * not need ten taps before it totals anything. The point of recording where
   * it came from is that a total built on our guesses about someone else's shop
   * must not look like a total built on their receipts. Both matter, so the
   * value is filled in and labelled rather than withheld.
   */
  priceFrom: 'ours' | 'mine' | null
}

export type Costing = {
  id: string | null
  name: string
  servings: number
  currency: string
  items: CostingItem[]
  sourceRecipeSlug: string | null
}

export const PACK_UNITS = ['g', 'ml', 'piece'] as const
const PACK_UNIT_SET = new Set<string>(PACK_UNITS)

/** Units a catalogue row may state its usage in. */
export const USE_UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', ''] as const

/**
 * Units a FREE-TEXT row may state its usage in.
 *
 * Only the unit it was bought in, plus whole and half packs. Without density or
 * a per-piece weight there is no way to turn "2 tbsp" of something bought by
 * the kilo into a number, so the engine would correctly refuse to price it —
 * and a row that goes blank after you typed a perfectly valid amount reads as a
 * bug. Not offering the dead end beats explaining it.
 */
export function useUnitsFor(item: CostingItem): readonly string[] {
  if (item.slug) return USE_UNITS
  return item.packUnit ? [item.packUnit, 'pack'] : ['pack']
}

export const MAX_ITEMS = 60
const MAX_NAME = 120

/** A costing with nothing in it, in the currency the cook is working in. */
export function emptyCosting(currency = BASE_CURRENCY): Costing {
  return {
    id: null,
    name: '',
    servings: 4,
    currency: isSupportedCurrency(currency) ? currency : BASE_CURRENCY,
    items: [],
    sourceRecipeSlug: null,
  }
}

export function emptyItem(label: string, slug: string | null = null): CostingItem {
  return {
    label,
    slug,
    priceMinor: null,
    packAmount: null,
    packUnit: null,
    useAmount: null,
    useUnit: null,
    priceFrom: null,
  }
}

/** Fill a new row's purchase side from a known price. */
export function withPrice(
  item: CostingItem,
  price: IngredientPrice,
  from: 'ours' | 'mine' = 'ours',
): CostingItem {
  return {
    ...item,
    priceFrom: from,
    priceMinor: price.priceMinor,
    packAmount: price.packAmount,
    packUnit: price.packUnit,
    // Seed the usage unit from how the thing is sold, so the common case needs
    // only a number typed. Something sold by the item starts as a count.
    useUnit: item.useUnit ?? (price.packUnit === 'piece' ? '' : price.packUnit),
  }
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/**
 * Read one item out of untrusted JSON.
 *
 * Returns null for anything that cannot be a row at all — a row with no label
 * has nothing to show and nothing to remove. Everything else is allowed to be
 * incomplete, because a half-filled row is a normal state while someone types.
 */
export function parseItem(raw: unknown): CostingItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const label = str(o.label, 200)
  if (!label) return null

  const packUnit = str(o.packUnit, 8)
  const priceMinor = num(o.priceMinor)
  const packAmount = num(o.packAmount)

  return {
    label,
    slug: str(o.slug, 200),
    // Bounded on both sides: a value the database would reject is not worth
    // carrying in a draft, and the row would fail to save with no explanation.
    priceMinor:
      priceMinor != null && priceMinor >= 0 && priceMinor <= MAX_MINOR
        ? Math.round(priceMinor)
        : null,
    packAmount:
      packAmount != null && Number.isFinite(packAmount) && packAmount >= 0.001 ? packAmount : null,
    packUnit: packUnit && PACK_UNIT_SET.has(packUnit) ? (packUnit as CostingItem['packUnit']) : null,
    useAmount: str(o.useAmount, 24),
    useUnit: typeof o.useUnit === 'string' ? o.useUnit.trim().slice(0, 12) : null,
    priceFrom: o.priceFrom === 'ours' || o.priceFrom === 'mine' ? o.priceFrom : null,
  }
}

/** Read a whole costing out of untrusted JSON — a Supabase row or localStorage. */
export function parseCosting(raw: unknown): Costing | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  const currency = str(o.currency, 3)?.toUpperCase()
  const servings = num(o.servings)
  const items = Array.isArray(o.items)
    ? o.items.map(parseItem).filter((i): i is CostingItem => i !== null)
    : []

  return {
    id: str(o.id, 64),
    name: str(o.name, MAX_NAME) ?? '',
    servings: servings != null && servings >= 1 && servings <= 100 ? Math.round(servings) : 4,
    currency: currency && isSupportedCurrency(currency) ? currency : BASE_CURRENCY,
    items: items.slice(0, MAX_ITEMS),
    sourceRecipeSlug: str(o.sourceRecipeSlug ?? o.source_recipe_slug, 200),
  }
}

/**
 * Turn a costing into what the engine wants.
 *
 * The price book is built FROM the items rather than passed in — every row
 * carries the price it was costed at. A key is minted for free-text rows so two
 * rows called the same thing at different prices stay separate.
 */
export function toCostInput(
  costing: Costing,
  lookup: (slug: string) => { densityGPerMl: number | null; gramsPerPiece: number | null } | null,
): { rows: CostRow[]; prices: PriceBook } {
  const prices: PriceBook = new Map()
  const rows: CostRow[] = costing.items.map((item, i) => {
    const key = item.slug ?? `free:${i}`
    if (item.priceMinor != null && item.packAmount != null && item.packUnit) {
      prices.set(key, {
        priceMinor: item.priceMinor,
        currency: costing.currency,
        packAmount: item.packAmount,
        packUnit: item.packUnit,
      })
    }
    const measures = item.slug ? lookup(item.slug) : null
    return {
      quantity: item.useAmount,
      // "pack" is this file's word for "one of whatever you bought"; the engine
      // reads an empty unit as a count, which is the same thing.
      unit: item.useUnit === 'pack' ? null : item.useUnit,
      item: item.label,
      ingredient: {
        slug: key,
        densityGPerMl: measures?.densityGPerMl ?? null,
        gramsPerPiece: measures?.gramsPerPiece ?? null,
      },
    }
  })
  return { rows, prices }
}

/**
 * The price per shelf unit: "£6.67/kg", "£2.40/l", "29p each".
 *
 * Derived, never stored. It is the number a shop puts on the label precisely
 * because it is the only one you can compare between a 90 g tub and a 300 g
 * one, and a calculator that already knows both halves has no excuse for
 * making someone work it out.
 */
export function unitPrice(
  item: CostingItem,
): { minor: number; per: string } | null {
  if (item.priceMinor == null || item.packAmount == null || !item.packUnit) return null
  // Number.isFinite, not `> 0`. NaN fails every comparison, so `packAmount <= 0`
  // let a NaN straight through and the shelf price rendered as NaN. A pack
  // smaller than a milligram is a typo rather than a pack, and dividing by it
  // produced figures like £25,000,000,000 per kilo.
  if (!Number.isFinite(item.packAmount) || item.packAmount < 0.001) return null
  if (!Number.isFinite(item.priceMinor)) return null
  const each = item.priceMinor / item.packAmount
  if (item.packUnit === 'piece') return { minor: each, per: 'each' }
  // Scale to the unit a shelf label uses, so the figure is comparable rather
  // than a fraction of a penny.
  return { minor: each * 1000, per: item.packUnit === 'ml' ? 'l' : 'kg' }
}

/** Is there enough here to be worth saving? */
export function isWorthSaving(costing: Costing): boolean {
  return costing.items.length > 0
}

/** A name to fall back on so a costing is never listed as blank. */
export function displayName(costing: Costing): string {
  return costing.name.trim() || 'Untitled costing'
}

// ── The unsaved draft ───────────────────────────────────────────────────────

/**
 * Kept under the key the first calculator already used. Renaming it would have
 * silently emptied the page for anyone mid-list when this ships, and the shape
 * only gained fields, so an older draft still parses.
 */
export const DRAFT_KEY = 'palate:cost-calculator'

export function readDraft(): Costing | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = parseCosting(JSON.parse(raw))
    return parsed && parsed.items.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export function writeDraft(costing: Costing): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(costing))
  } catch {
    /* private mode — the calculator still works for this sitting */
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* nothing to do — the draft simply outlives the session */
  }
}
