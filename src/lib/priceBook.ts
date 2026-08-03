import type { IngredientPrice, PriceBook } from './cost'
import { getActiveHouseholdId } from './household'
import { BASE_CURRENCY } from './money'
import { getPayloadClient } from './queries'
import { supabaseServer } from './supabase/server'

/**
 * Assemble the prices a recipe should be costed at.
 *
 * Two layers, and which one wins is the whole design:
 *
 *  1. A baseline shelf price authored per ingredient in the admin. It exists so
 *     a signed-out visitor still sees a costed recipe rather than an empty
 *     panel asking them to sign up — the cost is the feature, not the bait.
 *  2. What the cook actually pays, recorded in their own price book, shared
 *     with their household. This always wins, because the point of the feature
 *     is that our guess about their shop is worth less than their receipt.
 *
 * The baseline only applies when the cook is totalling in the currency it was
 * authored in. Nothing here converts: a cook in Tokyo does not want our London
 * pence quietly turned into yen at a rate we invented, so those ingredients
 * come back unpriced and the panel says so. That reads as a gap, and it is —
 * an honest one that their own prices fill.
 */

type PriceRow = {
  ingredient_slug: string
  price_minor: number
  currency: string
  pack_amount: number
  pack_unit: string
}

const VALID_UNITS = new Set(['g', 'ml', 'piece'])

function toEntry(row: {
  priceMinor: unknown
  currency: unknown
  packAmount: unknown
  packUnit: unknown
}): IngredientPrice | null {
  const priceMinor = Number(row.priceMinor)
  const packAmount = Number(row.packAmount)
  const currency = String(row.currency ?? '').toUpperCase()
  const packUnit = String(row.packUnit ?? '')
  if (!Number.isFinite(priceMinor) || priceMinor < 0) return null
  if (!Number.isFinite(packAmount) || packAmount <= 0) return null
  if (!/^[A-Z]{3}$/.test(currency)) return null
  if (!VALID_UNITS.has(packUnit)) return null
  return {
    priceMinor,
    currency,
    packAmount,
    packUnit: packUnit as IngredientPrice['packUnit'],
  }
}

/** The admin-authored shelf prices for these ingredients, in BASE_CURRENCY. */
export async function getBaselinePrices(slugs: string[]): Promise<PriceBook> {
  const book: PriceBook = new Map()
  if (slugs.length === 0) return book
  try {
    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'ingredients',
      where: { slug: { in: slugs } },
      depth: 0,
      limit: 500,
    })
    for (const doc of found.docs) {
      const d = doc as unknown as {
        slug?: string
        price?: { packPrice?: number | null; packAmount?: number | null; packUnit?: string | null }
      }
      if (!d.slug || !d.price) continue
      const entry = toEntry({
        priceMinor: d.price.packPrice,
        currency: BASE_CURRENCY,
        packAmount: d.price.packAmount,
        packUnit: d.price.packUnit,
      })
      if (entry) book.set(d.slug, entry)
    }
  } catch {
    // A costed panel is a nice-to-have; it must never take a recipe page down.
  }
  return book
}

/**
 * The signed-in cook's own prices, including any shared by their household.
 *
 * Returns an empty book when signed out, when Supabase is unconfigured, or
 * when the price-book table has not been created yet — the schema is applied
 * by hand, so this has to work before that has happened, the same way the
 * personal meal plan does.
 */
export async function getUserPrices(): Promise<PriceBook> {
  const book: PriceBook = new Map()
  const supabase = await supabaseServer()
  if (!supabase) return book

  const { data: auth } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!auth?.user) return book

  const householdId = await getActiveHouseholdId().catch(() => null)

  // Not filtered by household_id when there is no household: RLS already limits
  // a non-member to their own rows, and touching the column would break on a
  // database where the household block has not been run.
  let query = supabase
    .from('ingredient_prices')
    .select('ingredient_slug,price_minor,currency,pack_amount,pack_unit')
  if (householdId) query = query.eq('household_id', householdId)

  const { data, error } = await query
  if (error || !data) return book

  for (const raw of data as PriceRow[]) {
    const entry = toEntry({
      priceMinor: raw.price_minor,
      currency: raw.currency,
      packAmount: raw.pack_amount,
      packUnit: raw.pack_unit,
    })
    if (entry && raw.ingredient_slug) book.set(raw.ingredient_slug, entry)
  }
  return book
}

/**
 * Merge the two layers for a set of ingredients.
 *
 * `currency` is what the recipe will be totalled in. A baseline price authored
 * in another currency is left out rather than converted — see the note above.
 * The cook's own prices are passed through whatever their currency, so
 * computeCost can report a mismatch specifically instead of as a missing price.
 */
export async function getPriceBook(slugs: string[], currency: string): Promise<PriceBook> {
  const [baseline, mine] = await Promise.all([
    currency.toUpperCase() === BASE_CURRENCY ? getBaselinePrices(slugs) : Promise.resolve(new Map()),
    getUserPrices(),
  ])
  const merged: PriceBook = new Map(baseline)
  for (const [slug, entry] of mine) merged.set(slug, entry)
  return merged
}
