import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { imageFrom } from '@/lib/media'
import { countRecipesByCuisine, findCuisines } from '@/lib/queries'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Cuisines',
  description: 'Browse the catalog by cuisine.',
}

export default async function CuisinesPage() {
  const [cuisines, counts] = await Promise.all([findCuisines(), countRecipesByCuisine()])
  const active = cuisines.filter((c) => (counts.get(String(c.id)) ?? 0) > 0)

  return (
    <div className="shell py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-2 border-ink pb-5">
        <div>
          <p className="eyebrow m-0">Browse</p>
          <h1 className="mt-1 text-[clamp(1.875rem,3vw,2.75rem)]">Cuisines</h1>
        </div>
        <p className="m-0 max-w-[46ch] text-[0.9375rem] leading-snug text-slate">
          Each cuisine balances the same four things differently.{' '}
          <span className="text-ink">
            {active.length} of {cuisines.length} kitchens open
          </span>{' '}
          — the rest of the world fills in as creators arrive.
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3 min-[100rem]:grid-cols-4">
        {active.map((cuisine) => {
          const image = imageFrom(cuisine.heroImage, 'card')
          const count = counts.get(String(cuisine.id)) ?? 0

          return (
            <Link
              key={cuisine.id}
              href={`/cuisine/${cuisine.slug}`}
              className="ticket-card group block no-underline"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-wash">
                {image && (
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="p-5">
                <div className="leader">
                  <h2 className="text-[1.25rem] text-ink group-hover:underline">
                    {cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}
                    {cuisine.name}
                  </h2>
                  <span className="leader__dots" aria-hidden="true" />
                  <span className="eyebrow shrink-0">
                    {count} {count === 1 ? 'recipe' : 'recipes'}
                  </span>
                </div>
                {cuisine.description && (
                  <p className="mt-2 max-w-[46ch] text-[0.9375rem] leading-snug text-slate">
                    {cuisine.description}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
