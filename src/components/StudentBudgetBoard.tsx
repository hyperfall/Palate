'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export type StudentPick = {
  id: number
  slug: string
  title: string
  imageUrl: string | null
  /** Pence per plate; null when unpriced. */
  cost: number | null
  minutes: number | null
  servings: number
}

const CAPS = [
  { label: 'Any budget', cap: null },
  { label: '≤ £1.50', cap: 150 },
  { label: '≤ £2.50', cap: 250 },
  { label: '≤ £3.50', cap: 350 },
] as const

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`

/**
 * The student picks board with the budget dial. Cost-per-plate is the axis
 * students actually decide on, so it's a first-class control: tap a cap and
 * the board refilters instantly, every card wears its plate price, and the
 * running line does the maths nobody wants to do at 6pm — cheapest plate,
 * average, and (for feeding-people modes) what the whole table costs.
 */
export function StudentBudgetBoard({
  picks,
  servingsHint,
}: {
  picks: StudentPick[]
  servingsHint?: number
}) {
  const [cap, setCap] = useState<number | null>(null)

  const shown = useMemo(
    () => (cap == null ? picks : picks.filter((p) => p.cost != null && p.cost <= cap)),
    [picks, cap],
  )
  const priced = shown.filter((p) => p.cost != null) as Array<StudentPick & { cost: number }>
  const cheapest = priced.length ? Math.min(...priced.map((p) => p.cost)) : null
  const avg = priced.length ? Math.round(priced.reduce((a, p) => a + p.cost, 0) / priced.length) : null

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {CAPS.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={cap === c.cap}
            data-active={cap === c.cap}
            onClick={() => setCap(c.cap)}
            className="chip"
          >
            {c.label}
          </button>
        ))}
        {cheapest != null && (
          <span className="ml-auto font-mono text-[0.75rem] tracking-[0.06em] text-slate">
            cheapest plate {gbp(cheapest)}
            {avg != null && shown.length > 1 ? ` · average ${gbp(avg)}` : ''}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 max-w-[46ch] text-slate">
          Nothing under that cap in this mode — loosen the budget a notch, or{' '}
          <Link href="/recipes" className="text-flame underline underline-offset-2">
            browse everything
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((p) => (
            <Link
              key={p.id}
              href={`/recipes/${p.slug}${servingsHint ? `?servings=${servingsHint}` : ''}`}
              className="ticket-card group block no-underline"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-wash">
                {p.imageUrl && (
                  <Image
                    src={p.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                {p.cost != null && (
                  <span className="absolute right-2 bottom-2 rounded bg-pan-deep/80 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-[0.04em] text-milk">
                    ≈ {gbp(p.cost)} a plate
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-[1.0625rem] leading-tight text-ink group-hover:underline">{p.title}</h3>
                <p className="mt-1.5 flex flex-wrap gap-x-2 font-mono text-[0.6875rem] tracking-[0.06em] text-slate uppercase">
                  {p.minutes != null && <span>{p.minutes} min</span>}
                  {servingsHint && p.cost != null && (
                    <span className="text-flame">
                      {gbp(p.cost * servingsHint)} feeds {servingsHint}
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
