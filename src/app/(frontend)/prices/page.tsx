import type { Metadata } from 'next'
import Link from 'next/link'

import { PriceBookEditor, type PriceBookIngredient } from '@/components/PriceBookEditor'
import { getPayloadClient } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'What you pay',
  description: 'Record what ingredients cost where you shop, and every recipe prices itself.',
  // Private and personal — nothing here belongs in an index.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * The price book.
 *
 * The catalogue and our estimates are public, so they are fetched here; the
 * cook's own prices are loaded in the browser, because they are theirs and RLS
 * is what decides which rows — including a household partner's — they are
 * allowed to see.
 */
export default async function PricesPage() {
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'ingredients',
    depth: 0,
    limit: 1000,
    sort: 'name',
  })

  const ingredients: PriceBookIngredient[] = (
    found.docs as unknown as Array<Record<string, unknown>>
  ).map((d) => {
    const price = (d.price ?? {}) as Record<string, unknown>
    const usable =
      price.packPrice != null &&
      price.packAmount != null &&
      typeof price.packUnit === 'string' &&
      Number(price.packAmount) > 0
    return {
      slug: String(d.slug),
      name: String(d.name),
      category: (d.category as string | null) ?? null,
      baseline: usable
        ? {
            priceMinor: Number(price.packPrice),
            packAmount: Number(price.packAmount),
            packUnit: String(price.packUnit),
          }
        : null,
    }
  })

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[60ch]">
        <p className="eyebrow m-0 text-flame">Costs</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">What you pay.</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Every recipe shows what it costs to cook and what a plate comes to. Out of the box that
          uses our estimate of a shelf price, which is a guess about a shop we have never been to.
          Record what you actually pay for the things you buy often and the numbers become yours —
          on every recipe, and on your{' '}
          <Link href="/plan" className="text-flame underline underline-offset-4">
            week
          </Link>
          . Prices are shared with your household.
        </p>
      </header>

      <PriceBookEditor ingredients={ingredients} />
    </div>
  )
}
