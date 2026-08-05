import type { Metadata } from 'next'

import { TasteNight } from '@/components/TasteNight'
import { formatMinutes } from '@/lib/format'
import { imageFrom } from '@/lib/media'
import { findFeaturedRecipes } from '@/lib/queries'

export const metadata: Metadata = {
  alternates: { canonical: '/taste-night' },
  title: 'Taste Night, the Palate quiz',
  description:
    'Eight quick questions on ingredients, technique, and your own palate. Score at the end, plus the dish your answers say you should cook tonight.',
}

export const revalidate = 3600

/**
 * Not a pub quiz bolted on: every question teaches a skill, reads your taste,
 * or leads to a dish — and the finale converts play into dinner. Real dishes
 * from the board feed the image round.
 */
export default async function TasteNightPage() {
  const recipes = await findFeaturedRecipes(12)
  const dishes = recipes.map((recipe) => ({
    title: recipe.title,
    image: imageFrom(recipe.heroImage, 'card')?.url ?? null,
    cuisine: typeof recipe.cuisine === 'object' ? (recipe.cuisine?.name ?? null) : null,
    totalLabel: formatMinutes(recipe.totalMinutes),
  }))

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Taste Night</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">The Palate quiz.</h1>
        <p className="mt-3 text-slate max-sm:hidden">
          Eight questions, under five minutes. Some test your kitchen knowledge; some quietly read
          your palate. Either way it ends with dinner.
        </p>
      </header>

      <div className="mt-10 max-w-[64rem]">
        <TasteNight dishes={dishes} />
      </div>
    </div>
  )
}
