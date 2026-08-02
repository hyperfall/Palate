import type { Metadata } from 'next'

import { CuisineCards, type CuisineCardData } from '@/components/CuisineCards'
import { animatedUrlFor } from '@/lib/animated'
import { imageFrom } from '@/lib/media'
import { countRecipesByCuisine, findCuisines } from '@/lib/queries'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Cuisines',
  description: 'Browse the catalog by cuisine.',
}

export default async function CuisinesPage() {
  const [cuisines, counts] = await Promise.all([findCuisines({ withImages: true }), countRecipesByCuisine()])
  const active = cuisines.filter((c) => (counts.get(String(c.id)) ?? 0) > 0)

  return (
    <div className="shell py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-2 border-ink pb-5">
        <div>
          <p className="eyebrow m-0">Browse</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Cuisines</h1>
        </div>
        <p className="m-0 max-w-[46ch] text-note leading-snug text-slate">
          Each cuisine balances the same four things differently.{' '}
          <span className="text-ink">
            {active.length} of {cuisines.length} kitchens open
          </span>{' '}
          — the rest of the world fills in as creators arrive.
        </p>
      </header>

      <CuisineCards
        items={active.map((cuisine): CuisineCardData => {
          const image = imageFrom(cuisine.heroImage, 'card')
          return {
            slug: String(cuisine.slug),
            name: cuisine.name,
            flagEmoji: cuisine.flagEmoji ?? null,
            description: cuisine.description ?? null,
            count: counts.get(String(cuisine.id)) ?? 0,
            imageUrl: image?.url ?? null,
            imageAlt: image?.alt ?? '',
            // Filename convention: media/animated/<slug>.mp4 — drop a file and
            // the card animates on the next revalidate, no admin wiring.
            videoUrl: animatedUrlFor(String(cuisine.slug)),
          }
        })}
      />
    </div>
  )
}
