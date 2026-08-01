'use client'

import { useEffect, useState } from 'react'

import { BRAND_CTA_CLASS, BRAND_THUMB_CLASS, BrandCardFace } from '@/components/BrandCardFace'

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
          <BrandCardFace
            key={card.id}
            brand={card.brand}
            tagline={card.tagline}
            thumb={
              card.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- client fetch; next/image buys nothing here
                <img src={card.image.url} alt="" width={64} height={64} className={BRAND_THUMB_CLASS} />
              ) : undefined
            }
            cta={
              <a
                href={`/brand-slot/click?card=${encodeURIComponent(String(card.id))}&recipe=${encodeURIComponent(recipeSlug)}`}
                rel="sponsored nofollow noopener"
                target="_blank"
                className={BRAND_CTA_CLASS}
              >
                {card.ctaLabel}
              </a>
            }
          />
        ))
      )}
    </aside>
  )
}
