import Image from 'next/image'
import Link from 'next/link'

import type { Recipe } from '@/payload-types'
import { imageFrom } from '@/lib/media'
import { formatMinutes } from '@/lib/format'
import { StarRating } from './StarRating'
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
  // ratingScore is editorial-override-or-community-average; only shown once a
  // recipe actually has a score, so unrated cards stay clean.
  const ratingScore = recipe.ratingScore ?? 0

  return (
    <article className={`ticket-card group ${featured ? 'flex h-full flex-col' : ''}`}>
      <Link
        href={`/recipes/${recipe.slug}${servingsHint ? `?servings=${servingsHint}` : ''}`}
        // The whole tile is one link; without a name a screen reader would
        // concatenate the alt, meta, title, rating, and taste labels into one
        // exhausting announcement. Name it by the dish (and its rating).
        aria-label={ratingScore > 0 ? `${recipe.title}, rated ${ratingScore} out of 5` : recipe.title}
        className={`ticket-focus no-underline ${featured ? 'flex h-full flex-col' : 'block'}`}
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
              // Matches the real catalog grids: 1-col on phones, 2-col to lg,
              // 3-col at xl, 4-col beyond — so the browser stops picking a
              // 25vw candidate for a ~33vw slot.
              sizes={
                featured
                  ? '(max-width: 640px) 100vw, (max-width: 1280px) 66vw, 50vw'
                  : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw'
              }
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03] group-focus-within:scale-[1.03]"
            />
          )}
        </div>

        <div
          className={`relative isolate overflow-hidden bg-card ${featured ? 'p-5 sm:p-6' : 'p-4'}`}
        >
          {/*
            Ambient wash — a blurred copy of the hero image that blooms up from
            under the photo on hover. Reuses the already-loaded image URL (no
            extra request); decorative, so hidden from assistive tech.
          */}
          {image && (
            <div
              aria-hidden="true"
              className="card-ambient"
              style={{ backgroundImage: `url("${image.url}")` }}
            />
          )}

          <div className="relative z-10">
            {/* One ticket row: a long cuisine name truncates, the time · serves
                fact never does (it's shrink-0), and a missing cuisine leaves no
                orphan separator. */}
            <p
              className={`eyebrow m-0 flex items-baseline gap-x-1.5 overflow-hidden whitespace-nowrap ${
                featured ? 'sm:text-[0.9375rem]' : ''
              }`}
            >
              {cuisine && (
                <span className="min-w-0 shrink truncate">
                  {cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}
                  {cuisine.name} ·
                </span>
              )}
              <span className="shrink-0">
                {formatMinutes(recipe.totalMinutes)} · Serves {recipe.servings}
              </span>
            </p>

            <h3
              className={`mt-2 text-ink underline-offset-2 group-hover:underline group-focus-within:underline ${
                featured
                  ? 'text-[clamp(1.5rem,2vw,2.25rem)]'
                  : 'text-[1.375rem] leading-[1.15]'
              }`}
            >
              {recipe.title}
            </h3>

            {ratingScore > 0 && (
              <StarRating
                value={ratingScore}
                count={recipe.ratingCount ?? 0}
                size="sm"
                className="mt-2.5"
              />
            )}

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
        </div>
      </Link>
    </article>
  )
}
