import type { CalculatorIngredient } from '@/components/calculator/CostingEditor'
import { imageFrom } from './media'
import { BASE_CURRENCY } from './money'
import { getPayloadClient } from './queries'

/**
 * The ingredient catalogue, as the calculator needs it.
 *
 * Public and identical for everyone — the catalogue, our researched prices, and
 * the density and per-piece weights that make unit conversion possible. The
 * cook's own prices are NOT here: those are loaded in the browser, because RLS
 * is what decides which rows, including a household partner's, they may see.
 */
export async function loadCalculatorIngredients(): Promise<CalculatorIngredient[]> {
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'ingredients',
    // depth 1 so the image relationship resolves to a URL.
    depth: 1,
    limit: 1000,
    sort: 'name',
  })

  return (found.docs as unknown as Array<Record<string, unknown>>).map((d) => {
    const price = (d.price ?? {}) as Record<string, unknown>
    const usable =
      price.packPrice != null &&
      price.packAmount != null &&
      typeof price.packUnit === 'string' &&
      Number(price.packAmount) > 0
    const img = imageFrom(d.image as never, 'thumbnail') ?? imageFrom(d.image as never)

    return {
      slug: String(d.slug),
      name: String(d.name),
      category: (d.category as string | null) ?? null,
      image: img ? { url: img.url, alt: String(d.name) } : null,
      densityGPerMl: (d.densityGPerMl as number | null) ?? null,
      gramsPerPiece: (d.gramsPerPiece as number | null) ?? null,
      baseline: usable
        ? {
            priceMinor: Number(price.packPrice),
            packAmount: Number(price.packAmount),
            packUnit: String(price.packUnit) as 'g' | 'ml' | 'piece',
            currency: BASE_CURRENCY,
          }
        : null,
    }
  })
}
