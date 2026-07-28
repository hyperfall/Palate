import type { Metadata } from 'next'
import Link from 'next/link'

import { getPayloadClient, findUsedIngredientSlugs } from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Ingredients',
  description:
    'Every ingredient on the board — what to cook with it, what to swap it for, and what it’s usually cooked alongside.',
  alternates: { canonical: absoluteUrl('/ingredients') },
}

export default async function IngredientsPage() {
  const payload = await getPayloadClient()
  const [all, usedSlugs] = await Promise.all([
    payload.find({
      collection: 'ingredients',
      depth: 0,
      pagination: false,
      sort: 'name',
      select: { name: true, slug: true },
    }),
    findUsedIngredientSlugs(),
  ])

  // Only what something actually cooks with — a canonical row nothing uses
  // would lead to an empty page.
  const used = new Set(usedSlugs)
  const cooked = all.docs.filter((i) => i.slug && used.has(i.slug))

  // Grouped by initial, not by category: every canonical row currently sits in
  // "other", so grouping on it would print one enormous heading and help nobody.
  // An alphabet is what you actually scan a pantry list with.
  const byLetter = new Map<string, typeof cooked>()
  for (const ing of cooked) {
    const letter = (ing.name?.[0] ?? '#').toUpperCase()
    const key = /[A-Z]/.test(letter) ? letter : '#'
    byLetter.set(key, [...(byLetter.get(key) ?? []), ing])
  }
  const groups = [...byLetter.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[58ch]">
        <p className="eyebrow m-0">The pantry</p>
        <h1 className="mt-1 text-[clamp(1.75rem,4.5vw,3rem)] leading-[1.05]">
          Every ingredient, and what to do with it.
        </h1>
        <p className="mt-3 text-lg text-slate max-sm:hidden">
          Each one knows which recipes use it, what to reach for when you’re out, and what it tends
          to be cooked alongside.
        </p>
      </header>

      {cooked.length === 0 ? (
        <p className="mt-10 text-slate">
          Nothing linked yet —{' '}
          <Link href="/recipes" className="text-flame underline underline-offset-4">
            browse the board
          </Link>
          .
        </p>
      ) : (
        <div className="mt-10 grid gap-9">
          {groups.map(([letter, items]) => (
            <section key={letter}>
              <h2 className="m-0 font-display text-[1.5rem] leading-none text-flame">{letter}</h2>
              <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
                {items.map((ing) => (
                  <li key={ing.id}>
                    <Link href={`/ingredients/${ing.slug}`} className="chip no-underline">
                      {ing.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
