'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatPlatePrice } from '@/lib/format'

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

const gbp = (pence: number) => formatPlatePrice(pence) ?? '—'

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
  // Custom cap: pounds in the box, pence in the state, active when set.
  const [custom, setCustom] = useState(false)
  const [customPence, setCustomPence] = useState<number | null>(null)
  const activeCap = custom ? customPence : cap

  const shown = useMemo(
    () => (activeCap == null ? picks : picks.filter((p) => p.cost != null && p.cost <= activeCap)),
    [picks, activeCap],
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
            aria-pressed={!custom && cap === c.cap}
            data-active={!custom && cap === c.cap}
            onClick={() => {
              setCustom(false)
              setCap(c.cap)
            }}
            className="chip"
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          data-active={custom}
          onClick={() => setCustom(true)}
          className="chip"
        >
          Custom
        </button>
        {custom && (
          <label className="flex items-center gap-1 font-mono text-detail text-ink">
            <span aria-hidden="true">≤ £</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              max={20}
              step={0.1}
              autoFocus
              aria-label="Custom budget per plate, pounds"
              placeholder="2.00"
              onChange={(e) => {
                const v = Number.parseFloat(e.target.value)
                setCustomPence(Number.isNaN(v) || v <= 0 ? null : Math.round(v * 100))
              }}
              // Native spinners are useless for a budget (nobody nudges by 0.1p)
              // and they crowd the value out of the field. Strip them.
              className="w-20 rounded border border-rule bg-transparent px-2 py-1 text-ink tabular-nums [appearance:textfield] focus:border-flame focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-slate">a plate</span>
          </label>
        )}
        {cheapest != null && (
          <span className="ml-auto font-mono text-caption tracking-[0.06em] text-slate">
            cheapest plate {gbp(cheapest)}
            {avg != null && shown.length > 1 ? ` · average ${gbp(avg)}` : ''}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 max-w-[46ch] text-slate">
          Nothing under that cap in this mode. Loosen the budget a notch, or{' '}
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
                  <span className="absolute right-2 bottom-2 rounded bg-pan-deep/80 px-2 py-0.5 font-mono text-tag font-semibold tracking-[0.04em] text-milk">
                    ≈ {gbp(p.cost)} a plate
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-read leading-tight text-ink group-hover:underline">{p.title}</h3>
                <p className="mt-1.5 flex flex-wrap gap-x-2 font-mono text-tag tracking-[0.06em] text-slate uppercase">
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
