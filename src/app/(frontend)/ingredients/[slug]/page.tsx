import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PantryToggle } from '@/components/PantryToggle'
import { RecipeCard } from '@/components/RecipeCard'
import {
  findIngredientBySlug,
  findIngredientGraph,
  findUsedIngredientSlugs,
} from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

export async function generateStaticParams() {
  // Only ingredients a published recipe actually uses — the canonical table
  // carries entries that nothing cooks with yet, and an empty page is worse
  // than no page.
  const slugs = await findUsedIngredientSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ingredient = await findIngredientBySlug(slug)
  if (!ingredient) return {}

  const { recipes } = await findIngredientGraph(ingredient.id)
  const count = recipes.length
  return {
    title: `Cooking with ${ingredient.name}`,
    description:
      count > 0
        ? `${count} ${count === 1 ? 'recipe uses' : 'recipes use'} ${ingredient.name} on Palate — plus what to swap it for and what it's usually cooked with.`
        : `What to cook with ${ingredient.name}, what to swap it for, and what it pairs with.`,
    alternates: { canonical: absoluteUrl(`/ingredients/${ingredient.slug}`) },
  }
}

/** A quantity-free label for a substitution row. */
function subLabel(sub: { sub?: unknown; subText?: string | null }): string | null {
  if (sub.sub && typeof sub.sub === 'object') {
    const rel = sub.sub as { name?: string }
    return rel.name ?? null
  }
  return sub.subText ?? null
}

const KIND_COPY: Record<string, string> = {
  flavor: 'closest in flavour',
  texture: 'closest in texture',
  cupboard: 'what’s already in the cupboard',
}

export default async function IngredientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ingredient = await findIngredientBySlug(slug)
  if (!ingredient) notFound()

  const { recipes, pairsWith } = await findIngredientGraph(ingredient.id)
  const subs = (ingredient.substitutions ?? []).filter((s) => subLabel(s))
  const n = ingredient.nutrition

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[58ch]">
        <p className="eyebrow m-0">
          <Link href="/ingredients" className="text-slate no-underline hover:text-flame">
            Ingredients
          </Link>
        </p>
        <h1 className="mt-1 text-[clamp(1.75rem,4.5vw,3rem)] leading-[1.05]">
          Cooking with {ingredient.name}.
        </h1>
        <p className="mt-3 text-slate">
          {recipes.length > 0
            ? `${recipes.length} ${recipes.length === 1 ? 'recipe on the board uses' : 'recipes on the board use'} it.`
            : 'Nothing on the board uses it yet — it’s in the pantry, waiting.'}
        </p>
        {/* Filling the pantry used to mean typing each item into cook-from's
            search box. Browsing and tapping what you own is a shorter road. */}
        <div className="mt-4">
          <PantryToggle slug={ingredient.slug} name={ingredient.name} />
        </div>
      </header>

      {/* What to reach for instead. The substitution data is authored per
          ingredient, so it's the same answer wherever it's asked. */}
      {subs.length > 0 && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="m-0 text-[1.25rem]">Out of it? Use</h2>
          <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((s, i) => {
              const label = subLabel(s)
              const href =
                s.sub && typeof s.sub === 'object' && (s.sub as { slug?: string }).slug
                  ? `/ingredients/${(s.sub as { slug: string }).slug}`
                  : null
              return (
                <li key={i} className="ticket-card is-static p-4">
                  <p className="m-0 text-[1.0625rem] font-semibold text-ink">
                    {href ? (
                      <Link href={href} className="text-ink no-underline hover:text-flame">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </p>
                  <p className="mt-1 m-0 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">
                    {KIND_COPY[s.kind] ?? s.kind}
                    {s.ratio ? ` · ${s.ratio}` : ''}
                  </p>
                  {s.note && <p className="mt-2 m-0 text-[0.875rem] leading-snug text-slate">{s.note}</p>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Counted from the recipes themselves, not authored — the ingredient
          backbone is what makes this answerable at all. */}
      {pairsWith.length > 0 && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="m-0 text-[1.25rem]">Cooked alongside</h2>
          <p className="mt-1 text-[0.875rem] text-slate">
            Counted from the recipes themselves — the number is how many share it.
          </p>
          <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
            {pairsWith.map((p) => (
              <li key={p.id}>
                <Link href={`/ingredients/${p.slug}`} className="chip no-underline">
                  {p.name}
                  {p.count > 1 && <span className="ml-1.5 text-slate">{p.count}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipes.length > 0 && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="m-0 text-[1.25rem]">On the board</h2>
          <div className="mt-5 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </section>
      )}

      {n?.kcalPer100g != null && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="m-0 text-[1.25rem]">Per 100 g</h2>
          <dl className="mt-4 grid max-w-[30rem] gap-2">
            {[
              ['Energy', `${Math.round(n.kcalPer100g)} kcal`],
              ['Protein', n.proteinPer100g != null ? `${n.proteinPer100g} g` : null],
              ['Carbohydrate', n.carbsPer100g != null ? `${n.carbsPer100g} g` : null],
              ['Fat', n.fatPer100g != null ? `${n.fatPer100g} g` : null],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="leader">
                  <dt className="eyebrow">{label}</dt>
                  <span className="leader__dots" aria-hidden="true" />
                  <dd className="datum m-0">{value}</dd>
                </div>
              ))}
          </dl>
          <p className="mt-3 text-[0.8125rem] text-slate">Reference values, not a measured sample.</p>
        </section>
      )}
    </div>
  )
}
