import type { Metadata } from 'next'
import Link from 'next/link'

import { getPayloadClient, findUsedIngredientSlugs } from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

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

      {/* An A–Z rail: 110 chips is a lot of scrolling to reach "yoghurt". Plain
          anchors, so it works with no JavaScript, and the site-wide smooth
          scroll makes the jump glide rather than teleport. Letters with nothing
          under them are rendered as dimmed text, not dead links. */}
      {groups.length > 1 && (
        <nav
          aria-label="Jump to letter"
          // scroll-mt on the sections is deliberately small: html already
          // carries scroll-padding-top for the sticky header, and the two add
          // up — 32 sent every heading 90px past the rail.
          className="sticky top-[3.75rem] z-20 -mx-4 mt-8 border-y border-rule bg-paper/95 px-4 py-2.5 backdrop-blur"
        >
          <ul className="m-0 flex list-none flex-wrap gap-x-1 gap-y-1 p-0">
            {ALPHABET.map((letter) => {
              const has = byLetter.has(letter)
              return (
                <li key={letter}>
                  {has ? (
                    <a
                      href={`#letter-${letter}`}
                      className="grid h-7 w-7 place-items-center rounded font-mono text-[0.8125rem] text-ink no-underline transition-colors hover:bg-flame hover:text-paper"
                    >
                      {letter}
                    </a>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid h-7 w-7 place-items-center font-mono text-[0.8125rem] text-slate/30"
                    >
                      {letter}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      )}

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
            <section key={letter} id={`letter-${letter}`} className="scroll-mt-12">
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
