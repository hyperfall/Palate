import Image from 'next/image'
import Link from 'next/link'

import { RecipeCard } from '@/components/RecipeCard'
import { AXIS_COLOR } from '@/components/TasteGauge'
import { formatMinutes } from '@/lib/format'
import { imageFrom } from '@/lib/media'
import { countRecipesByCuisine, findCuisines, findFeaturedRecipes } from '@/lib/queries'
import { TASTE_AXES, TASTE_AXIS_LABELS, tasteLabel, type TasteAxis } from '@/lib/taxonomy'

export const revalidate = 3600

/**
 * §7 asks the home page to invite *exploration*. The hero is the product's
 * thesis made operable: the taste board — four meters, each graduation a link
 * into a pre-filtered catalog.
 *
 *  · Flavour axes: tap a level → "at least this much" (`n-5`); the zero tick →
 *    "none at all" (`0-0`).
 *  · Effort: tap a level → "at most this much work" (`0-n`); the top tick →
 *    "I want a project" (`4-5`).
 */
function heroHref(axis: TasteAxis, level: number): string {
  if (axis === 'effort') {
    return level === 5 ? `/recipes?effort=4-5` : `/recipes?effort=0-${level}`
  }
  return level === 0 ? `/recipes?${axis}=0-0` : `/recipes?${axis}=${level}-5`
}

function heroTickLabel(axis: TasteAxis, level: number): string {
  const word = tasteLabel(axis, level)
  if (axis === 'effort') {
    return level === 5 ? 'Recipes that are a real project' : `Recipes with at most ${word} effort`
  }
  return level === 0
    ? `Recipes with ${word?.toLowerCase()} ${TASTE_AXIS_LABELS[axis].title.toLowerCase()}`
    : `Recipes at least ${word?.toLowerCase()}`
}

/** The service ticker — the site's one ambient motion. */
function Ticker({ recipeCount }: { recipeCount: number }) {
  const items = [
    'No life stories',
    `${recipeCount} recipes on the board`,
    'Every dish measured on four axes',
    'Kitchen-tested before publish',
    'Partners marked, recipes untouched',
  ]
  const run = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined} className="inline-flex items-baseline">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-baseline font-mono text-[0.875rem] font-medium tracking-[0.16em] text-ink uppercase"
        >
          <span className="px-6">{item}</span>
          <span aria-hidden="true">✳</span>
        </span>
      ))}
    </span>
  )

  return (
    <div className="ticker border-y border-ink/20 bg-butter py-2.5" role="presentation">
      <div className="ticker__inner">
        {run(false)}
        {run(true)}
      </div>
    </div>
  )
}

export default async function HomePage() {
  // Five recipes fill the mosaic exactly (a 2×2 lead plus four singles);
  // three more feed the hero's plate rail without repeating the mosaic.
  const [featured, cuisines, counts] = await Promise.all([
    findFeaturedRecipes(8),
    findCuisines(),
    countRecipesByCuisine(),
  ])

  const [lead, ...rest] = featured.slice(0, 5)
  const passRail = featured.slice(5, 8)
  const recipeCount = [...counts.values()].reduce((sum, n) => sum + n, 0)

  return (
    <div>
      {/* The pass. Dark, full-bleed — headline, playable board, real plates. */}
      <section className="bg-pan text-milk">
        <div className="shell grid gap-12 py-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-20 lg:py-16 xl:grid-cols-[1fr_0.9fr_14.5rem] 2xl:gap-24">
          <div>
            <p className="m-0 font-mono text-[0.8125rem] font-semibold tracking-[0.16em] text-flame-text uppercase">
              Tonight’s service
            </p>
            <h1 className="mt-4 text-[clamp(2.5rem,4.6vw,4.5rem)] text-milk">
              Cook first. Read later, if you feel like it.
            </h1>
            <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-milk/85">
              No life story between you and the ingredients. Just the recipe, measured on the
              four things that decide whether you actually want to make it.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/recipes" className="btn-primary">
                Browse the board
              </Link>
              <Link
                href="/cuisines"
                className="font-mono text-[0.8125rem] font-medium tracking-[0.12em] text-milk uppercase underline underline-offset-4 hover:text-flame"
              >
                Explore cuisines
              </Link>
            </div>
          </div>

          {/* The taste board — the instrument, used as the way in. */}
          <div
            className="rounded-md border border-pan-line bg-pan-deep p-6 sm:p-8"
            style={{ ['--meter-rest' as string]: 'rgb(238 240 228 / 0.14)' }}
          >
            <p className="m-0 font-body text-[1.0625rem] font-semibold text-milk">
              How do you want to eat tonight?
            </p>

            <div className="mt-7 grid gap-6">
              {TASTE_AXES.map((axis) => {
                // Flavours read as a floor ("at least"), effort as a ceiling
                // ("at most") — the one asymmetry the board has to teach.
                const atMost = axis === 'effort'
                return (
                  <div key={axis} style={{ ['--gauge-hue' as string]: AXIS_COLOR[axis] }}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-body text-[0.9375rem] font-semibold text-milk">
                        {TASTE_AXIS_LABELS[axis].title}
                        <span className="ml-2 font-mono text-[0.6875rem] font-medium tracking-[0.08em] text-milk/55 uppercase">
                          {atMost ? '≤ at most' : '≥ at least'}
                        </span>
                      </span>
                      <span className="font-body text-[0.8125rem] text-milk/80">
                        {TASTE_AXIS_LABELS[axis].scale[0]} → {TASTE_AXIS_LABELS[axis].scale[5]}
                      </span>
                    </div>

                    {/*
                      Discrete graduations, but hovering one dials up every bar
                      before it (CSS `:has`) so the row reads like a filled meter
                      — the word above the thumb names the level you'd pick.
                    */}
                    <div className="axis-track mt-2.5 flex items-end gap-1">
                      {[0, 1, 2, 3, 4, 5].map((level) => (
                        <Link
                          key={level}
                          href={heroHref(axis, level)}
                          aria-label={heroTickLabel(axis, level)}
                          data-word={tasteLabel(axis, level) ?? `Level ${level}`}
                          className="axis-btn"
                        >
                          <span
                            className="axis-tick"
                            style={{
                              height: `${0.5 + level * 0.2}rem`,
                              // The scale is printed on the face: each graduation
                              // carries a wash of its own value.
                              ['--tick-strength' as string]: `${38 + level * 12}%`,
                            }}
                          />
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-6 font-body text-[0.875rem] leading-relaxed text-milk/85">
              Tap a level — flavours mean “at least this much”, effort means “at most”.
            </p>
          </div>

          {/*
            The plates. Real dishes clipped to the pass rail — the appetite the
            board's abstraction can't carry on its own. Vertical stack on wide
            screens, a scrollable strip everywhere else.
          */}
          {/* min-w-0: without it this grid item's intrinsic width (three fixed
              tickets) overrides the column and drags the page wider on phones. */}
          <div className="min-w-0 lg:col-span-2 xl:col-span-1 xl:self-center">
            <p className="m-0 font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-milk/75 uppercase">
              Fresh off the pass
            </p>
            <div className="scroll-rail mt-3 flex snap-x gap-4 overflow-x-auto pb-2 xl:flex-col xl:gap-5 xl:overflow-visible xl:pb-0">
              {passRail.map((recipe, i) => {
                const image = imageFrom(recipe.heroImage, 'card')
                return (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.slug}`}
                    className="group w-[13rem] shrink-0 snap-start rounded-sm border border-ink/40 bg-card p-2 no-underline shadow-(--shadow-block-sm) transition-transform duration-200 motion-safe:hover:rotate-0 xl:w-auto"
                    style={{ rotate: `${[-1.6, 1.2, -1][i % 3]}deg` }}
                  >
                    {image && (
                      <Image
                        src={image.url}
                        alt=""
                        width={image.width ?? 800}
                        height={image.height ?? 600}
                        sizes="(max-width: 1280px) 208px, 232px"
                        className="aspect-[8/5] w-full rounded-[2px] object-cover"
                      />
                    )}
                    <span className="mt-2 block truncate font-mono text-[0.8125rem] font-semibold tracking-[0.06em] text-ink uppercase group-hover:text-flame">
                      {recipe.title}
                    </span>
                    <span className="block font-mono text-[0.8125rem] tracking-[0.08em] text-slate uppercase">
                      {formatMinutes(recipe.totalMinutes)} · serves {recipe.servings}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <Ticker recipeCount={recipeCount} />

      {/* The board. Lead recipe runs 2×2; the mosaic fills the screen. */}
      <section className="shell py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-[clamp(1.75rem,2.5vw,2.5rem)]">On the board</h2>
          <Link
            href="/recipes"
            className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-ink uppercase no-underline hover:text-flame"
          >
            All recipes →
          </Link>
        </div>

        <div className="mt-8 grid grid-flow-dense grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {lead && (
            <div className="sm:col-span-2 sm:row-span-2">
              <RecipeCard recipe={lead} featured />
            </div>
          )}
          {rest.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </section>

      {/* Stations. One row, edge to edge. */}
      <section className="border-y border-rule bg-wash">
        <div className="shell py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[clamp(1.75rem,2.5vw,2.5rem)]">By cuisine</h2>
            <Link
              href="/cuisines"
              className="font-mono text-[0.8125rem] font-medium tracking-[0.14em] text-ink uppercase no-underline hover:text-flame"
            >
              All cuisines →
            </Link>
          </div>

          {/* Two lead stations, six supporting — a rhythm, not a wall. The
              full atlas lives at /cuisines. */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...cuisines]
              // Only stations that actually have recipes — never showcase an
              // empty "0 recipes" hub on the front page.
              .filter((c) => (counts.get(String(c.id)) ?? 0) > 0)
              .sort(
                (a, b) =>
                  (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0),
              )
              .slice(0, 8)
              .map((cuisine, index) => {
              const image = imageFrom(cuisine.heroImage, 'card')
              const count = counts.get(String(cuisine.id)) ?? 0
              const lead = index < 2

              return (
                <Link
                  key={cuisine.id}
                  href={`/cuisine/${cuisine.slug}`}
                  className={`ticket-card group block no-underline ${lead ? 'sm:col-span-2' : ''}`}
                >
                  <div className={`relative overflow-hidden bg-rule ${lead ? 'aspect-[21/10]' : 'aspect-[16/9]'}`}>
                    {image && (
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-3 p-4">
                    <h3 className={`text-ink group-hover:underline ${lead ? 'text-[1.5rem]' : 'text-[1.25rem]'}`}>
                      {cuisine.flagEmoji ? `${cuisine.flagEmoji} ` : ''}
                      {cuisine.name}
                    </h3>
                    <span className="shrink-0 font-mono text-[0.8125rem] font-medium tracking-[0.08em] text-slate uppercase">
                      {count} {count === 1 ? 'recipe' : 'recipes'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* House rules — the promise, stated once, as ticket lines. */}
      <section className="shell py-14">
        <div className="grid gap-x-16 gap-y-8 md:grid-cols-3">
          {[
            {
              title: 'Kitchen-tested',
              body: 'Every authored recipe is cooked and verified by a human before it is published.',
            },
            {
              title: 'Recipe first',
              body: 'Stories are short, optional, and always after the method. Never in your way.',
            },
            {
              title: 'Partners, marked',
              body: 'Brand cards are labelled, rotated fairly, and never change a recipe.',
            },
          ].map((item, index) => (
            <div key={item.title} className="border-t-2 border-ink pt-4">
              <div className="leader">
                <h3 className="text-[1.125rem]">{item.title}</h3>
                <span className="leader__dots" aria-hidden="true" />
                <span className="datum text-flame">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-2 max-w-[38ch] text-[0.9375rem] leading-relaxed text-slate">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
