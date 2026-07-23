'use client'

import { useEffect, useState } from 'react'

export type BrandSlotCard = {
  id: string | number
  brand: string
  tagline: string
  ctaLabel: string
  ctaUrl: string
  image: { url: string; alt: string } | null
}

/**
 * The brand slot (design spec §2, §6).
 *
 * Loaded client-side from `/brand-slot` so the recipe page itself stays
 * statically generated — see that route for the full reasoning. The slot
 * reserves its own height while loading so filling it never shifts the method
 * out from under someone mid-cook.
 *
 * Two rules are baked in rather than left to policy:
 *  · It is labelled. §1's wager is that this site is the honest opposite of
 *    ad-farming, which only holds if a partner card is never mistaken for
 *    editorial.
 *  · Outbound links carry rel="sponsored nofollow". Passing PageRank to a
 *    paying partner is the manual-action bait §8 rules out.
 */
export function BrandSlot({ recipeSlug }: { recipeSlug: string }) {
  const [cards, setCards] = useState<BrandSlotCard[] | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/brand-slot?recipe=${encodeURIComponent(recipeSlug)}`)
      .then((res) => (res.ok ? res.json() : { cards: [] }))
      .then((data) => {
        if (!cancelled) setCards(data.cards ?? [])
      })
      .catch(() => {
        // A partner card is never worth breaking a recipe over.
        if (!cancelled) setCards([])
      })

    return () => {
      cancelled = true
    }
  }, [recipeSlug])

  if (cards !== null && cards.length === 0) return null

  return (
    <aside aria-label="Partner" className="min-h-[13rem]">
      {cards === null ? (
        <div aria-hidden="true" className="h-[13rem] rounded-md border border-rule bg-wash" />
      ) : (
        cards.map((card) => (
          <div
            key={card.id}
            className="rounded-md border border-dashed border-slate/60 bg-card p-5"
          >
            <p className="eyebrow m-0">— Partner —</p>

            <div className="mt-3 flex items-start gap-4">
              {card.image && (
                // eslint-disable-next-line @next/next/no-img-element -- client fetch; next/image buys nothing here
                <img
                  src={card.image.url}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-sm object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="m-0 font-mono text-[0.875rem] font-semibold text-ink">{card.brand}</p>
                <p className="mt-1 text-[0.9375rem] leading-snug text-slate">{card.tagline}</p>
              </div>
            </div>

            <a
              href={`/brand-slot/click?card=${encodeURIComponent(String(card.id))}&recipe=${encodeURIComponent(recipeSlug)}`}
              rel="sponsored nofollow noopener"
              target="_blank"
              className="mt-4 inline-block rounded border border-ink px-4 py-2 font-mono text-[0.8125rem] font-semibold tracking-[0.08em] text-ink uppercase no-underline transition-colors hover:bg-ink hover:text-paper"
            >
              {card.ctaLabel}
            </a>
          </div>
        ))
      )}
    </aside>
  )
}
