'use client'

import Link from 'next/link'
import { useState } from 'react'

import { inferProfile, encodeVector, type TasteVector, type DishRating } from '@/lib/tasteProfile'
import { saveTasteProfile } from '@/lib/tasteProfileStore'
import { TastePanel } from './TasteGauge'

export type OnboardingDish = {
  id: number
  title: string
  cuisine: string | null
  image: { url: string; alt: string } | null
  taste: TasteVector
}

/**
 * "Rate a few dishes" — tap Love it / Not for me on a handful of known dishes;
 * the liked ones' taste axes average into a saved profile that then personalises
 * /tonight and the catalog. No accounts — the profile lives in localStorage.
 */
export function TasteOnboarding({ dishes }: { dishes: OnboardingDish[] }) {
  const [index, setIndex] = useState(0)
  const [ratings, setRatings] = useState<DishRating[]>([])
  const [result, setResult] = useState<TasteVector | null | undefined>(undefined)

  const rate = async (liked: boolean) => {
    const next = [...ratings, { liked, dish: dishes[index].taste }]
    setRatings(next)
    if (index + 1 < dishes.length) {
      setIndex(index + 1)
    } else {
      const profile = inferProfile(next)
      if (profile) await saveTasteProfile(profile)
      setResult(profile)
    }
  }

  if (result !== undefined) {
    if (!result) {
      return (
        <div>
          <h2 className="text-[clamp(1.75rem,3.5vw,3rem)]">Nothing caught your eye.</h2>
          <p className="mt-3 max-w-[46ch] text-slate">
            We build your profile from the dishes you like — try again and say yes to a few.
          </p>
          <button
            type="button"
            onClick={() => {
              setRatings([])
              setIndex(0)
              setResult(undefined)
            }}
            className="btn-primary mt-6"
          >
            Start over
          </button>
        </div>
      )
    }
    return (
      <div>
        <p className="eyebrow m-0 text-flame">Your taste, saved</p>
        <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.75rem)]">Here’s what you lean toward.</h2>
        <div className="ticket-card mt-6 max-w-[32rem] p-6">
          <TastePanel recipe={result} />
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/tonight" className="btn-primary">
            Find tonight’s dinner →
          </Link>
          <Link
            href={`/recipes?sort=foryou&tp=${encodeVector(result)}`}
            className="font-mono text-detail font-medium tracking-[0.12em] text-ink uppercase underline underline-offset-4 hover:text-flame"
          >
            Recipes for your taste
          </Link>
        </div>
      </div>
    )
  }

  const dish = dishes[index]
  return (
    <div>
      <p className="eyebrow m-0 text-flame">
        Dish {index + 1} of {dishes.length}
      </p>
      <div className="ticket-card mt-4 grid overflow-hidden lg:grid-cols-[1.1fr_1fr]">
        <div className="relative min-h-[15rem] bg-wash lg:min-h-[22rem]">
          {dish.image && (
            // eslint-disable-next-line @next/next/no-img-element -- small onboarding set
            <img src={dish.image.url} alt={dish.image.alt} className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
        <div className="p-6 sm:p-8">
          {dish.cuisine && <p className="eyebrow m-0">{dish.cuisine}</p>}
          <h2 className="mt-2 text-[clamp(1.5rem,3vw,2.5rem)]">{dish.title}</h2>
          <div className="mt-6">
            <TastePanel recipe={dish.taste} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => rate(true)} className="btn-primary">
              Love it
            </button>
            <button
              type="button"
              onClick={() => rate(false)}
              className="chip !min-h-[2.75rem] !px-5"
            >
              Not for me
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
