import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BrandSlot } from '@/components/BrandSlot'
import { AddToPlan } from '@/components/AddToPlan'
import { ConvertedText } from '@/components/ConvertedText'
import { CookModeLauncher } from '@/components/CookMode'
import { CreatorByline } from '@/components/CreatorByline'
import { MethodTabs } from '@/components/MethodTabs'
import { NutritionPanel } from '@/components/NutritionPanel'
import { PrintRecipe } from '@/components/PrintRecipe'
import { SaveRecipe } from '@/components/SaveRecipe'
import { IngredientsPanel } from '@/components/IngredientsPanel'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { RateWidget } from '@/components/RateWidget'
import { RecipeCard } from '@/components/RecipeCard'
import { RecipeJsonLd } from '@/components/RecipeJsonLd'
import { TastePanel } from '@/components/TasteGauge'
import { VideoEmbed } from '@/components/VideoEmbed'
import { formatMinutes, formatTimer } from '@/lib/format'
import { lexicalToPlainText } from '@/lib/lexical'
import { imageFrom } from '@/lib/media'
import { HeroAnnotations, type HeroPin } from '@/components/HeroAnnotations'
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

  // Feed the optimizer the full-res original so big/retina screens get real
  // pixels (Next resizes + emits AVIF per device); the thumbnail is the blur-up.
  const hero = imageFrom(recipe.heroImage) ?? imageFrom(recipe.heroImage, 'hero')
  const heroLqip = imageFrom(recipe.heroImage, 'thumbnail')?.url ?? null
  // Art-direct the crop from the media's focal point so the dish, not the frame
  // centre, anchors the un-cropped hero.
  const heroMedia = typeof recipe.heroImage === 'object' ? recipe.heroImage : null
  const heroFocal =
    heroMedia && heroMedia.focalX != null && heroMedia.focalY != null
      ? `${heroMedia.focalX}% ${heroMedia.focalY}%`
      : '50% 50%'
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
        <header className="group/hero relative overflow-hidden bg-pan text-milk">
          {hero && (
            <>
              {/* Blur-up: the tiny thumbnail shows instantly, scaled + blurred,
                  under the priority hero so there's never a bare pan rectangle. */}
              {heroLqip && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 scale-110 bg-cover blur-2xl"
                  style={{ backgroundImage: `url(${heroLqip})`, backgroundPosition: heroFocal }}
                />
              )}
              <Image
                src={hero.url}
                alt={hero.alt}
                fill
                priority
                sizes="100vw"
                quality={82}
                className="object-cover"
                style={{ objectPosition: heroFocal }}
              />
            </>
          )}
          {/* Un-dimmed: the plate stays vivid. A soft wash rises only across the
              lower third, so the oversized title reads without muting the food. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pan-deep/90 via-pan-deep/25 to-transparent" />

          <HeroAnnotations items={recipe.heroAnnotations as HeroPin[] | null} />

          {/* Type block is inert to the pointer so the annotation layer beneath it
              still catches hover/tap on the photo; only the controls opt back in. */}
          <div className="shell pointer-events-none relative z-30 flex min-h-[56vh] flex-col justify-end py-12 lg:min-h-[64vh]">
            <div data-hero-type className="max-w-[min(100%,44rem)]">
              <span className="mb-4 block h-[3px] w-12 bg-flame" aria-hidden="true" />
              <h1 className="max-w-[15ch] text-[clamp(2.75rem,8vw,6rem)] leading-[0.9] tracking-[-0.01em] text-balance text-milk">
                {recipe.title}
              </h1>
              {/* The decision line — cuisine, time, servings, difficulty. It sat at
                  13px under a 96px title, a 7:1 jump that left the actual
                  decision-making information whispering. */}
              <p className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[clamp(0.875rem,1.05vw,1.0625rem)] tracking-[0.02em] text-milk">
                {cuisine && (
                  <>
                    <Link
                      href={`/cuisine/${cuisine.slug}`}
                      className="pointer-events-auto text-flame no-underline hover:underline"
                    >
                      {cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}
                      {cuisine.name}
                    </Link>
                    <span aria-hidden="true" className="text-milk/40">·</span>
                  </>
                )}
                <span>{formatMinutes(recipe.totalMinutes)}</span>
                <span aria-hidden="true" className="text-milk/40">·</span>
                <span>Serves {recipe.servings}</span>
                <span aria-hidden="true" className="text-milk/40">·</span>
                <span className="capitalize">{recipe.difficulty}</span>
                {communityAverage > 0 && (
                  <>
                    <span aria-hidden="true" className="text-milk/40">·</span>
                    <span>{communityAverage.toFixed(1)} ★</span>
                  </>
                )}
              </p>

              <div className="pointer-events-auto mt-7 flex flex-wrap items-center gap-3">
                <CookModeLauncher
                  title={recipe.title}
                  slug={recipe.slug}
                  ingredients={(recipe.ingredients ?? []).map((row) => ({
                    quantity: row.quantity,
                    unit: row.unit,
                    item: row.item,
                    note: row.note,
                    heading: row.heading,
                    ingredient: typeof row.ingredient === 'object' ? row.ingredient : null,
                  }))}
                  baseServings={recipe.servings ?? 1}
                  image={imageFrom(recipe.heroImage, 'card')?.url ?? null}
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
                {/* The print stylesheet turns this page into a kitchen card;
                    nobody would guess that from Ctrl+P, so offer the door. */}
                <PrintRecipe />
              </div>

              <div className="pointer-events-auto mt-6 max-w-[22rem]">
                <RateWidget
                  recipeId={recipe.id}
                  initialAverage={communityAverage}
                  initialCount={ratingCount}
                  tone="dark"
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

            <div className="content-start">
              <ProvenanceBadge
                provenance={recipe.provenance as Provenance}
                attribution={recipe.sourceAttribution}
              />
              {author && author.handle && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[1rem] leading-snug text-slate">
                  Written by{' '}
                  <CreatorByline name={author.name} handle={author.handle} verified={Boolean(author.verified)} />
                </p>
              )}
              {author && !author.handle && (
                <p className="mt-2 text-[1rem] leading-snug text-slate">
                  Written by <span className="text-ink">{author.name}</span>
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
          className="shell grid scroll-mt-20 gap-x-14 gap-y-10 py-10 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,48rem)] 2xl:grid-cols-[minmax(18rem,22rem)_minmax(0,72rem)] 2xl:gap-x-20"
        >
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <IngredientsPanel
              slug={recipe.slug}
              ingredients={recipe.ingredients ?? []}
              baseServings={recipe.servings}
            />

            <NutritionPanel nutrition={recipe.nutrition} />

            <div className="mt-8">
              <BrandSlot recipeSlug={recipe.slug} />
            </div>
          </aside>

          {/* The method — a reading column, not a page-wide river. On xl the column
              opens up so each step's photo can sit in the margin beside it; the
              text and every prose block below re-cap themselves to a measure. */}
          <div className="max-w-[70ch] 2xl:max-w-none">
            <div className="border-t-2 border-ink pt-4">
              <h2 className="text-[1.5rem]">Method</h2>
            </div>

            {/* Instructions by default; a creator's Story can replace them via
                the toggle (opt-in — the recipe still comes first). */}
            <div className="mt-6">
              <MethodTabs story={recipe.storyMarkdown}>
                {/* Numbered because the order genuinely carries information here. */}
                <ol className="list-none space-y-7 p-0">
                  {(recipe.steps ?? []).map((step, index) => (
                    <li
                      key={step.id ?? index}
                      className="grid grid-cols-[3rem_1fr] gap-x-4 gap-y-4 2xl:grid-cols-[3rem_minmax(32rem,40rem)_minmax(0,22rem)] 2xl:gap-x-8"
                    >
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
                      {/* A step photo answers "does mine look right?" — the one
                          question text can't. It stacks under the step on narrow
                          screens and moves into the right margin on xl, where it
                          costs the reading column nothing. */}
                      {(() => {
                        const shot = imageFrom(step.image, 'card')
                        if (!shot) return null
                        return (
                          <div className="col-start-2 2xl:col-start-3 2xl:row-start-1">
                            <Image
                              src={shot.url}
                              alt={shot.alt || `Step ${index + 1} of ${recipe.title}`}
                              width={shot.width ?? 800}
                              height={shot.height ?? 600}
                              sizes="(min-width: 1536px) 22rem, (min-width: 1024px) 40rem, 100vw"
                              className="w-full rounded-lg border border-rule object-cover"
                            />
                          </div>
                        )
                      })()}
                    </li>
                  ))}
                </ol>
              </MethodTabs>
            </div>

            {/* The creator's own video — their reach is the reward for sharing. */}
            {recipe.videoUrl && (
              <section className="mt-14 max-w-[70ch] border-t border-rule pt-6">
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
              <section className="mt-14 max-w-[70ch] border-t border-rule pt-6">
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
