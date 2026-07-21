import Image from 'next/image'
import Link from 'next/link'

import type { Recipe } from '@/payload-types'
import { imageFrom } from '@/lib/media'
import { formatMinutes } from '@/lib/format'
import { TasteTags } from './TasteGauge'

/**
 * Catalog card, styled as a kitchen ticket: photograph on top, then a mono
 * meta rail (cuisine · time · serves), the title in the menu voice, and the
 * two taste facts that decide whether someone cooks it tonight.
 *
 * `featured` doubles the tile in the home mosaic — same ticket, bigger plate.
 */
export function RecipeCard({
  recipe,
  featured = false,
  servingsHint,
}: {
  recipe: Recipe
  featured?: boolean
  /** Pre-scales the recipe's servings on arrival (e.g. party mode). */
  servingsHint?: number
}) {
  const image = imageFrom(recipe.heroImage, featured ? 'hero' : 'card')
  const cuisine = typeof recipe.cuisine === 'object' ? recipe.cuisine : null

  return (
    <article className={`ticket-card group ${featured ? 'flex h-full flex-col' : ''}`}>
      <Link
        href={`/recipes/${recipe.slug}${servingsHint ? `?servings=${servingsHint}` : ''}`}
        className={`no-underline ${featured ? 'flex h-full flex-col' : 'block'}`}
      >
        <div
          className={`relative overflow-hidden bg-wash ${
            featured ? 'min-h-[16rem] flex-1' : 'aspect-[4/3]'
          }`}
        >
          {image && (
            <Image
              src={image.url}
              alt={image.alt}
              fill
              // The featured tile is the home page's LCP — load it eagerly.
              priority={featured}
              sizes={
                featured
                  ? '(max-width: 640px) 100vw, (max-width: 1280px) 66vw, 50vw'
                  : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
              }
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
        </div>

        <div className={featured ? 'p-5 sm:p-6' : 'p-4'}>
          <p className="eyebrow m-0">
            {cuisine ? `${cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}${cuisine.name} · ` : ''}
            {formatMinutes(recipe.totalMinutes)} · Serves {recipe.servings}
          </p>

          <h3
            className={`mt-2 text-ink group-hover:underline ${
              featured
                ? 'text-[clamp(1.5rem,2vw,2.25rem)]'
                : 'text-[1.1875rem] leading-tight'
            }`}
          >
            {recipe.title}
          </h3>

          <TasteTags
            recipe={{
              spiciness: recipe.spiciness,
              sweetness: recipe.sweetness,
              richness: recipe.richness,
              effort: recipe.effort,
            }}
            className="mt-3"
          />
        </div>
      </Link>
    </article>
  )
}
