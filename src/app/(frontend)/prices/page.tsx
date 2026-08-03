import type { Metadata } from 'next'
import Link from 'next/link'

import { CostCalculator, type CalculatorIngredient } from '@/components/CostCalculator'
import { imageFrom } from '@/lib/media'
import { BASE_CURRENCY } from '@/lib/money'
import { getPayloadClient } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Cost calculator',
  description: 'Add ingredients, see what a dish costs, and price it from your own shop.',
  // Personal once you sign in, and not a page worth ranking — the recipes are.
  robots: { index: false, follow: false },
}

export const revalidate = 3600

/**
 * The cost calculator.
 *
 * The catalogue and our shelf-price estimates are public and identical for
 * everyone, so the page itself is static; the cook's own prices are loaded in
 * the browser, because RLS is what decides which rows — theirs and their
 * household's — they may see.
 */
export default async function PricesPage() {
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'ingredients',
    // depth 1 so the image relationship resolves to a URL.
    depth: 1,
    limit: 1000,
    sort: 'name',
  })

  const ingredients: CalculatorIngredient[] = (
    found.docs as unknown as Array<Record<string, unknown>>
  ).map((d) => {
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

  const priced = ingredients.filter((i) => i.baseline).length

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[60ch]">
        <p className="eyebrow m-0 text-flame">Costs</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">What does it cost?</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Add ingredients and amounts, and it totals as you go — the whole dish, and what one plate
          comes to. It starts from {priced} researched UK shelf prices, and every one of them is a
          number you can correct: put in what your shop charges and it sticks, on this page and on
          every{' '}
          <Link href="/recipes" className="text-flame underline underline-offset-4">
            recipe
          </Link>
          . Prices are shared with your household.
        </p>
      </header>

      <CostCalculator ingredients={ingredients} />
    </div>
  )
}
