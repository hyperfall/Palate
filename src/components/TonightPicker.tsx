'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { TASTE_AXES, TASTE_AXIS_LABELS, type TasteAxis } from '@/lib/taxonomy'
import { readTasteProfile } from '@/lib/useTasteProfile'
import { CookingLoader } from './CookingLoader'
import { AXIS_COLOR, TastePanel } from './TasteGauge'

type Pick = {
  id: number
  slug: string
  title: string
  cuisine: string | null
  cuisineFlag: string | null
  totalLabel: string
  servings: number
  difficulty: string
  calories: number | null
  taste: Record<TasteAxis, number>
  image: { url: string; alt: string } | null
}

const TIME_CHOICES = [
  { label: 'Under 20 min', value: 20 },
  { label: 'Under 35 min', value: 35 },
  { label: 'Under an hour', value: 60 },
  { label: 'Time is no object', value: null },
] as const

/**
 * Five taps, one answer. Each question is a single screen with big word
 * buttons; the result is ONE recipe stated with confidence, not a grid to
 * doom-scroll. "Another one" rerolls without repeats; "Start over" resets.
 */
export function TonightPicker() {
  const [answers, setAnswers] = useState<Partial<Record<TasteAxis, number>>>({})
  const [prefilled, setPrefilled] = useState(false)
  const [time, setTime] = useState<number | null | undefined>(undefined)

  // Seed the taste answers from a saved profile so a returning visitor jumps
  // straight to "how long have you got?" — they can still step Back to adjust.
  useEffect(() => {
    const profile = readTasteProfile()
    if (!profile) return
    setAnswers((a) =>
      Object.keys(a).length > 0
        ? a
        : {
            spiciness: profile.spiciness,
            sweetness: profile.sweetness,
            richness: profile.richness,
            effort: profile.effort,
          },
    )
    setPrefilled(true)
  }, [])
  const [pick, setPick] = useState<Pick | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [seen, setSeen] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  // Guards against a fast double-tap on "Show me another": without it, an
  // earlier request resolving after a later one could overwrite the newer
  // pick with a stale one.
  const abortRef = useRef<AbortController | null>(null)

  const axisIndex = TASTE_AXES.findIndex((axis) => answers[axis] === undefined)
  const stage: 'axis' | 'time' | 'result' =
    axisIndex >= 0 ? 'axis' : time === undefined ? 'time' : 'result'

  const fetchPick = async (
    finalAnswers: Partial<Record<TasteAxis, number>>,
    finalTime: number | null,
    excludeIds: number[],
  ) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    const params = new URLSearchParams()
    for (const axis of TASTE_AXES) params.set(axis, String(finalAnswers[axis] ?? 2))
    if (finalTime) params.set('time', String(finalTime))
    if (excludeIds.length > 0) params.set('not', excludeIds.join(','))

    try {
      const res = await fetch(`/tonight/pick?${params}`, { signal: controller.signal })
      const data = (await res.json()) as { pick: Pick | null; remaining: number }
      setPick(data.pick)
      setRemaining(data.remaining)
      if (data.pick) setSeen([...excludeIds, data.pick.id])
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') return
      setPick(null)
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  const reset = () => {
    abortRef.current?.abort()
    setAnswers({})
    setTime(undefined)
    setPick(null)
    setSeen([])
  }

  const stepNumber = stage === 'axis' ? axisIndex + 1 : 5

  if (stage === 'axis' || stage === 'time') {
    const axis = stage === 'axis' ? TASTE_AXES[axisIndex] : null

    return (
      <div>
        <p className="eyebrow m-0 text-flame">Question {stepNumber} of 5</p>
        {prefilled && (
          <p className="mt-2 font-mono text-[0.75rem] text-slate">
            Prefilled from your taste profile ·{' '}
            <button
              type="button"
              onClick={() => {
                setPrefilled(false)
                reset()
              }}
              className="cursor-pointer border-none bg-transparent p-0 font-inherit text-flame underline underline-offset-2"
            >
              start fresh
            </button>
          </p>
        )}

        {axis ? (
          <>
            <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,3rem)]">
              How much {TASTE_AXIS_LABELS[axis].title.toLowerCase()} tonight?
            </h2>
            <div
              className="mt-8 grid gap-2.5 sm:grid-cols-3"
              style={{ ['--axis-hue' as string]: AXIS_COLOR[axis] }}
            >
              {TASTE_AXIS_LABELS[axis].scale.map((word, level) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [axis]: level }))}
                  className="ticket-card flex cursor-pointer items-center gap-3 p-4 text-left"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-[2px]"
                    style={{ background: AXIS_COLOR[axis], opacity: 0.25 + level * 0.15 }}
                  />
                  <span className="font-mono text-[0.875rem] font-semibold">{word}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,3rem)]">How long have you got?</h2>
            <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {TIME_CHOICES.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => {
                    setTime(choice.value)
                    void fetchPick(answers, choice.value, [])
                  }}
                  className="ticket-card cursor-pointer p-4 text-left font-mono text-[0.875rem] font-semibold"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </>
        )}

        {stepNumber > 1 && (
          <button
            type="button"
            onClick={() => {
              if (axis) {
                const prev = TASTE_AXES[axisIndex - 1]
                setAnswers((a) => {
                  const next = { ...a }
                  delete next[prev]
                  return next
                })
              } else {
                const last = TASTE_AXES[TASTE_AXES.length - 1]
                setAnswers((a) => {
                  const next = { ...a }
                  delete next[last]
                  return next
                })
              }
            }}
            className="mt-8 cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.12em] text-slate uppercase underline-offset-4 hover:underline"
          >
            ← Back
          </button>
        )}
      </div>
    )
  }

  // Result.
  if (loading) {
    return <CookingLoader label="Checking the board" center />
  }

  if (!pick) {
    return (
      <div>
        <h2 className="text-[clamp(1.75rem,3.5vw,3rem)]">Nothing fits all of that.</h2>
        <p className="mt-3 max-w-[44ch] text-slate">
          Usually the clock is the constraint — try again with a longer window.
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-6">
          Start over
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="eyebrow m-0 text-flame">Tonight you’re cooking</p>
      <div className="ticket-card mt-4 grid overflow-hidden lg:grid-cols-[1.2fr_1fr]">
        <div className="relative min-h-[16rem] bg-wash lg:min-h-[24rem]">
          {pick.image && (
            // eslint-disable-next-line @next/next/no-img-element -- client-fetched result
            <img
              src={pick.image.url}
              alt={pick.image.alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
        <div className="p-6 sm:p-8">
          <p className="eyebrow m-0">
            {[
              pick.cuisine ? `${pick.cuisineFlag ? `${pick.cuisineFlag} ` : ''}${pick.cuisine}` : null,
              pick.totalLabel,
              `Serves ${pick.servings}`,
              pick.calories ? `${pick.calories} kcal` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.75rem)]">{pick.title}</h2>
          <div className="mt-6">
            <TastePanel recipe={pick.taste} />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={`/recipes/${pick.slug}`} className="btn-primary">
              Cook it →
            </Link>
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => void fetchPick(answers, time ?? null, seen)}
                className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] font-medium tracking-[0.12em] text-ink uppercase underline-offset-4 hover:underline"
              >
                Show me another
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.12em] text-slate uppercase underline-offset-4 hover:underline"
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
