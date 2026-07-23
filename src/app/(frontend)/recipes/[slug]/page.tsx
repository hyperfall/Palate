import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BrandSlot } from '@/components/BrandSlot'
import { AddToPlan } from '@/components/AddToPlan'
import { ConvertedText } from '@/components/ConvertedText'
import { CookModeLauncher } from '@/components/CookMode'
import { SaveRecipe } from '@/components/SaveRecipe'
import { IngredientsPanel } from '@/components/IngredientsPanel'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { RateWidget } from '@/components/RateWidget'
import { RecipeCard } from '@/components/RecipeCard'
import { RecipeJsonLd } from '@/components/RecipeJsonLd'
import { StarRating } from '@/components/StarRating'
import { TastePanel } from '@/components/TasteGauge'
import { VideoEmbed } from '@/components/VideoEmbed'
import { formatMinutes, formatTimer } from '@/lib/format'
import { lexicalToPlainText } from '@/lib/lexical'
import { imageFrom } from '@/lib/media'
import { findAllRecipeSlugs, findRecipeBySlug, findRelatedRecipes } from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'
import { buildCookSteps } from '@/lib/stepIngredients'
import type { Provenance } from '@/lib/taxonomy'

export const revalidate = 3600 // ISR — §8 asks for SSG/ISR on recipe pages.

export async function generateStaticParams() {
  const slugs = await findAllRecipeSlugs()
  return slugs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const recipe = await findRecipeBySlug(slug)
  if (!recipe) return {}

  const og = imageFrom(recipe.ogImage ?? recipe.heroImage, 'og')
  const description =
    recipe.metaDescription ??
    (recipe.story ? lexicalToPlainText(recipe.story as never).slice(0, 180) : undefined) ??
    `A ${formatMinutes(recipe.totalMinutes)} recipe for ${recipe.title}.`

  const canonical = absoluteUrl(`/recipes/${recipe.slug}`)

  return {
    title: recipe.metaTitle ?? recipe.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: recipe.metaTitle ?? recipe.title,
      description,
      url: canonical,
      type: 'article',
      ...(og ? { images: [{ url: og.url, width: og.width, height: og.height }] } : {}),
    },
    // §3/§8: imported content is duplicate content across the web and must not
    // dilute the authored catalog's ranking.
    ...(recipe.provenance === 'api-imported' ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const recipe = await findRecipeBySlug(slug)
  if (!recipe) notFound()

  const related = await findRelatedRecipes(recipe)

  const hero = imageFrom(recipe.heroImage, 'hero')
  const cuisine = typeof recipe.cuisine === 'object' ? recipe.cuisine : null
  const author = typeof recipe.author === 'object' ? recipe.author : null
  const story = recipe.story ? lexicalToPlainText(recipe.story as never) : ''

  // The community tally shown to users is always the real average of real votes
  // (sum ÷ count) — the editorial override drives sort/filter, never the number
  // a reader sees. Zero votes shows nothing here; the widget invites the first.
  const ratingCount = recipe.ratingCount ?? 0
  const communityAverage =
    ratingCount > 0 ? Math.round(((recipe.ratingSum ?? 0) / ratingCount) * 100) / 100 : 0

  return (
    <>
      <RecipeJsonLd recipe={recipe} />

      {/*
        §10's success criterion: a stranger can cook from this page within ten
        seconds of arriving. The hero band carries the decision — title, taste,
        time — and the pass below it is the workspace: ticket, method,
        ingredients, side by side on a wide screen.
      */}
      <article>
        {/* Full-bleed plate shot with the title over it. */}
        <header className="relative bg-pan text-milk">
          {hero && (
            <Image
              src={hero.url}
              alt={hero.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-55"
            />
          )}
          <div className="relative bg-gradient-to-t from-pan-deep/95 via-pan-deep/40 to-transparent">
            <div className="shell flex min-h-[44vh] flex-col justify-end py-10 lg:min-h-[52vh]">
              {cuisine && (
                <Link
                  href={`/cuisine/${cuisine.slug}`}
                  className="eyebrow w-fit text-flame no-underline hover:underline"
                >
                  {cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}
                  {cuisine.name}
                </Link>
              )}
              <h1 className="mt-3 max-w-[18ch] text-[clamp(2.5rem,5vw,4.75rem)] text-milk">
                {recipe.title}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2">
                <span className="datum text-milk">
                  <span className="eyebrow mr-2 text-milk/80">Total</span>
                  {formatMinutes(recipe.totalMinutes)}
                </span>
                <span className="datum text-milk">
                  <span className="eyebrow mr-2 text-milk/80">Serves</span>
                  {recipe.servings}
                </span>
                <span className="datum text-milk capitalize">
                  <span className="eyebrow mr-2 text-milk/80">Difficulty</span>
                  {recipe.difficulty}
                </span>
                {ratingCount > 0 && (
                  <span className="datum text-milk">
                    <span className="eyebrow mr-2 text-milk/80">Rated</span>
                    <StarRating value={communityAverage} count={ratingCount} />
                  </span>
                )}
                <CookModeLauncher
                  title={recipe.title}
                  steps={buildCookSteps(
                    (recipe.steps ?? []).map((step) => ({
                      text: step.text,
                      timerSeconds: step.timerSeconds,
                      uses: Array.isArray(step.uses)
                        ? step.uses.map((u) =>
                            typeof u === 'object' && u
                              ? { name: u.name, substitutions: u.substitutions }
                              : u,
                          )
                        : null,
                    })),
                  )}
                  finish={recipe.finish ?? null}
                />
                <SaveRecipe
                  slug={recipe.slug}
                  title={recipe.title}
                  image={imageFrom(recipe.heroImage, 'card')?.url ?? null}
                />
                <AddToPlan
                  slug={recipe.slug}
                  title={recipe.title}
                  image={imageFrom(recipe.heroImage, 'card')?.url ?? null}
                />
              </div>
            </div>
          </div>
        </header>

        {/*
          The ticket band — the dish, measured, printed full-width across the
          pass: four taste meters, the clock, and who stands behind it. This is
          the strip a wide screen was bought for.
        */}
        <section aria-label="Recipe ticket" className="border-b border-rule bg-wash">
          <div className="shell grid gap-x-10 gap-y-6 py-7 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto] lg:gap-x-12 2xl:gap-x-16">
            <TastePanel
              recipe={{
                spiciness: recipe.spiciness,
                sweetness: recipe.sweetness,
                richness: recipe.richness,
                effort: recipe.effort,
              }}
              row
            />

            <dl className="m-0 grid min-w-[11rem] content-start gap-2.5">
              {[
                ['Prep', formatMinutes(recipe.prepMinutes)],
                ['Cook', formatMinutes(recipe.cookMinutes)],
                ['Total', formatMinutes(recipe.totalMinutes)],
              ].map(([label, value]) => (
                <div key={label} className="leader">
                  <dt className="eyebrow">{label}</dt>
                  <span className="leader__dots" aria-hidden="true" />
                  <dd className="datum m-0">{value}</dd>
                </div>
              ))}
            </dl>

            {recipe.nutrition?.calories != null && (
              <dl className="m-0 grid min-w-[11rem] content-start gap-2.5">
                {[
                  ['Calories', `${recipe.nutrition.calories} kcal`],
                  ['Protein', `${recipe.nutrition.protein ?? 0} g`],
                  ['Carbs', `${recipe.nutrition.carbs ?? 0} g`],
                  ['Fat', `${recipe.nutrition.fat ?? 0} g`],
                ].map(([label, value]) => (
                  <div key={label} className="leader">
                    <dt className="eyebrow">{label}</dt>
                    <span className="leader__dots" aria-hidden="true" />
                    <dd className="datum m-0">{value}</dd>
                  </div>
                ))}
                <p className="m-0 pt-0.5 font-mono text-[0.6875rem] tracking-[0.08em] text-slate/70 uppercase">
                  Estimated · per serving
                </p>
              </dl>
            )}

            <div className="content-start">
              <ProvenanceBadge
                provenance={recipe.provenance as Provenance}
                attribution={recipe.sourceAttribution}
              />
              {author && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[1rem] leading-snug text-slate">
                  Written by <span className="text-ink">{author.name}</span>
                  {author.verified && (
                    <span
                      title="Verified creator"
                      className="grid h-4 w-4 place-items-center rounded-full bg-flame text-[0.625rem] text-paper"
                    >
                      ✓
                    </span>
                  )}
                  {author.handle && (
                    <Link
                      href={`/creator/${author.handle}`}
                      className="font-mono text-[0.8125rem] text-slate no-underline hover:text-flame"
                    >
                      @{author.handle}
                    </Link>
                  )}
                </p>
              )}
              {(recipe.dietaryTags ?? []).length > 0 && (
                <div className="mt-3 flex max-w-[16rem] flex-wrap gap-1.5">
                  {(recipe.dietaryTags ?? []).map((tag) => (
                    <span key={tag} className="chip !min-h-0 !cursor-default !py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-rule pt-4">
                <RateWidget
                  recipeId={recipe.id}
                  initialAverage={communityAverage}
                  initialCount={ratingCount}
                />
              </div>
            </div>
          </div>
        </section>

        {/*
          The pass: ingredients stay in reach (sticky) while the method
          scrolls. DOM order — ingredients, then method — matches how a cook
          approaches a new dish on a phone.
        */}
        <div
          id="method"
          className="shell grid scroll-mt-20 gap-x-14 gap-y-10 py-10 lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] 2xl:gap-x-24"
        >
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <IngredientsPanel
              ingredients={recipe.ingredients ?? []}
              baseServings={recipe.servings}
            />

            <div className="mt-8">
              <BrandSlot recipeSlug={recipe.slug} />
            </div>
          </aside>

          {/* The method — a reading column, not a page-wide river. */}
          <div className="max-w-[70ch]">
            <div className="border-t-2 border-ink pt-4">
              <h2 className="text-[1.5rem]">Method</h2>
            </div>

            {/* Numbered because the order genuinely carries information here. */}
            <ol className="mt-6 list-none space-y-7 p-0">
              {(recipe.steps ?? []).map((step, index) => (
                <li key={step.id ?? index} className="grid grid-cols-[3rem_1fr] gap-4">
                  <span className="font-mono text-[1.375rem] leading-[1.3] font-semibold text-flame tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="m-0 text-[1.1875rem] leading-relaxed">
                      <ConvertedText text={step.text} />
                    </p>
                    {step.timerSeconds ? (
                      <p className="eyebrow mt-2">≈ {formatTimer(step.timerSeconds)}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            {/* The creator's own video — their reach is the reward for sharing. */}
            {recipe.videoUrl && (
              <section className="mt-14 border-t border-rule pt-6">
                <p className="eyebrow m-0">
                  {author ? `Watch ${author.name} make it` : 'Watch it made'}
                </p>
                <div className="mt-4">
                  <VideoEmbed
                    url={recipe.videoUrl}
                    title={`${recipe.title}${author ? ` by ${author.name}` : ''}`}
                  />
                </div>
              </section>
            )}

            {/* The story lives here, after the cooking — never before it (§1). */}
            {story && (
              <section className="mt-14 border-t border-rule pt-6">
                <p className="eyebrow m-0">Notes, if you feel like it</p>
                <p className="mt-3 text-[1.0625rem] leading-relaxed text-slate">{story}</p>
              </section>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="border-t border-rule bg-wash">
            <div className="shell py-12">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2 className="text-[clamp(1.5rem,2vw,2rem)]">
                  More {cuisine ? cuisine.name : 'recipes'}
                </h2>
                <Link
                  href={cuisine ? `/cuisine/${cuisine.slug}` : '/recipes'}
                  className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-ink uppercase no-underline hover:text-flame"
                >
                  See the station →
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 min-[100rem]:grid-cols-4">
                {related.map((item) => (
                  <RecipeCard key={item.id} recipe={item} />
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </>
  )
}
