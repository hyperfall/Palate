import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RecipeCard } from '@/components/RecipeCard'
import { parseFilters } from '@/lib/filters'
import { imageFrom } from '@/lib/media'
import { countRecipesByCuisine, findCuisineBySlug, findCuisines, findRecipes } from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

export async function generateStaticParams() {
  // Only pre-build hubs that actually have recipes. With 200+ world cuisines
  // seeded, building every empty one produces "no recipes yet" thin-content
  // pages that dilute the catalog's ranking. Empty hubs still resolve on
  // demand via ISR when a recipe finally lands — they're just noindex'd below.
  const [cuisines, counts] = await Promise.all([findCuisines(), countRecipesByCuisine()])
  return cuisines
    .filter((cuisine) => (counts.get(String(cuisine.id)) ?? 0) > 0)
    .map((cuisine) => ({ slug: cuisine.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cuisine = await findCuisineBySlug(slug)
  if (!cuisine) return {}

  const canonical = absoluteUrl(`/cuisine/${cuisine.slug}`)
  const description = cuisine.description ?? `${cuisine.name} recipes.`

  // An empty hub is thin content — keep it out of the index until it fills.
  // (Payload treats limit:0 as "unlimited", so use 1 and read totalDocs.)
  const { recipes, totalDocs } = await findRecipes(
    { ...parseFilters({}), cuisines: [cuisine.slug] },
    { limit: 1 },
  )

  // Share the food, not the wordmark. Declaring openGraph at all replaces the
  // site-wide card from opengraph-image.tsx rather than merging with it, so
  // without an image here a shared cuisine hub posted with no picture at all.
  // The hub's own top recipe is a better answer than restoring the generic
  // card anyway: a link to "Indian recipes" should look like Indian food.
  const top = recipes[0]
  const og = top ? imageFrom(top.ogImage ?? top.heroImage, 'og') : null

  return {
    title: `${cuisine.name} recipes`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${cuisine.name} recipes`,
      description,
      url: canonical,
      ...(og ? { images: [{ url: og.url, width: og.width, height: og.height }] } : {}),
    },
    ...(totalDocs === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

/** §7 cuisine hubs — the per-country SEO landing pages, styled as a station. */
export default async function CuisinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cuisine = await findCuisineBySlug(slug)
  if (!cuisine) notFound()

  const { recipes, totalDocs } = await findRecipes(
    { ...parseFilters({}), cuisines: [cuisine.slug] },
    { limit: 48 },
  )

  const hero = imageFrom(cuisine.heroImage, 'hero')

  return (
    <div>
      {/* Station header on the pass — full bleed, text over the photograph. */}
      <header className="relative bg-pan text-milk">
        {hero && (
          <Image
            src={hero.url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-45"
          />
        )}
        <div className="relative bg-gradient-to-t from-pan-deep/90 via-pan-deep/40 to-transparent">
          <div className="shell flex min-h-[38vh] flex-col justify-end py-12">
            <p className="eyebrow m-0 text-flame">
              Station · {totalDocs} {totalDocs === 1 ? 'recipe' : 'recipes'}
            </p>
            <h1 className="mt-3 text-[clamp(2.5rem,5.5vw,5rem)] text-milk">
              {cuisine.flagEmoji && <span className="mr-3 align-middle text-[0.55em]">{cuisine.flagEmoji}</span>}
              {cuisine.name}
            </h1>
            {cuisine.description && (
              <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-milk/80">
                {cuisine.description}
              </p>
            )}
          </div>
        </div>
      </header>

      <section className="shell py-10">
        {recipes.length === 0 ? (
          <div className="ticket-card max-w-[38rem] p-6">
            <p className="eyebrow m-0 text-flame">An unopened kitchen</p>
            <h2 className="mt-2 text-[clamp(1.35rem,3.5vw,1.75rem)] leading-tight">
              The {cuisine.name} kitchen is waiting for its first cook.
            </h2>
            <p className="mt-3 text-slate">
              Someone’s name is going to open this station: the founding cook, first on the pass,
              on every {cuisine.name} card that follows. Your recipe gets the full treatment: set
              beautifully, cookable step by step, plannable, shoppable, filtered by how it actually
              tastes.
            </p>
            <p className="mt-2 text-slate">
              You keep your name, your photo, your voice and your recipes, always.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link href="/studio" className="btn-primary">
                Open the {cuisine.name} kitchen →
              </Link>
              <Link
                href="/recipes"
                className="font-mono text-detail tracking-[0.12em] text-ink uppercase underline underline-offset-4 hover:text-flame"
              >
                Browse everything
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 min-[100rem]:grid-cols-4">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
