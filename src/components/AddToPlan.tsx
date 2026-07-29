'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { MEAL_LABELS, MEAL_ORDER, normalizeMeal, type MealType } from '@/lib/mealPlan'
import { supabaseBrowser, WEEKDAYS } from '@/lib/supabase/client'
import { signInHref } from '@/lib/signInRedirect'

type Planned = { id: string; day: number; meal: MealType }

/**
 * Week-aware add-to-plan on a recipe. Signed out (or unconfigured), routes to
 * /account. Signed in, it loads where this recipe already sits in the week and
 * lets you toggle it on/off per day + meal — so the recipe page reflects the
 * plan rather than firing blind inserts.
 */
export function AddToPlan({
  slug,
  title,
  image,
  eager = true,
  tone = 'paper',
}: {
  slug: string
  title: string
  image: string | null
  /** 'pan' for the recipe hero's dark ground; 'paper' anywhere the page shows. */
  tone?: 'paper' | 'pan'
  /**
   * Whether to look up "is this already in the week" on mount.
   *
   * True on a recipe page, where there is one of these and the answer is worth
   * showing at a glance. False in a grid: cook-from can render 72 of these, and
   * each lookup is three round trips — auth, household, meal_plan — so eager
   * mounting fired over 200 requests the moment the page appeared. There the
   * answer loads when the picker is opened.
   */
  eager?: boolean
}) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [meal, setMeal] = useState<MealType>('dinner')
  const [planned, setPlanned] = useState<Planned[]>([])
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supabase) return
    if (!eager && !open) return
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        setSignedIn(Boolean(data.user))
        if (!data.user) return
        // Scope to the shared week when in a household. When not (or before the
        // household migration has run), apply no filter — RLS already limits to
        // the user's own rows, and this avoids touching the household_id column.
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .maybeSingle()
        const householdId = (membership?.household_id as string | undefined) ?? null
        const base = supabase.from('meal_plan').select('id,day,meal').eq('recipe_slug', slug)
        const { data: rows } = await (householdId ? base.eq('household_id', householdId) : base)
        setPlanned(
          (rows ?? []).map((r) => ({ id: r.id as string, day: r.day as number, meal: normalizeMeal(r.meal as string) })),
        )
      })
      .catch(() => setSignedIn(false))
  }, [supabase, slug, eager, open])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  /** Tap a day: add this recipe to (day, current meal), or remove it if already there. */
  const toggle = async (day: number) => {
    if (!supabase || busy) return
    // The panel shouldn't be open when signed out, but the write is the thing
    // that actually touches the database, so it carries its own guard.
    if (signedIn !== true) {
      router.push(signInHref())
      return
    }
    setBusy(true)
    setError(null)
    try {
      const existing = planned.find((p) => p.day === day && p.meal === meal)
      if (existing) {
        const { error } = await supabase.from('meal_plan').delete().eq('id', existing.id)
        if (error) setError('Couldn’t update your week — try again.')
        else setPlanned((prev) => prev.filter((p) => p.id !== existing.id))
      } else {
        // Position: every insert defaulted to 0, so multi-dish slots had
        // undefined order until a manual drag. Epoch seconds appends new dishes
        // after existing ones (drag renumbers to small ints, which sort first).
        const { data, error } = await supabase
          .from('meal_plan')
          .insert({
            day,
            meal,
            recipe_slug: slug,
            recipe_title: title,
            recipe_image: image,
            position: Math.floor(Date.now() / 1000),
          })
          .select('id')
          .single()
        if (error) setError('Couldn’t update your week — try again.')
        else if (data) setPlanned((prev) => [...prev, { id: data.id as string, day, meal }])
      }
    } finally {
      setBusy(false)
    }
  }

  const inWeek = planned.length > 0

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          // `!== true`, not `=== false`: while auth is still resolving this is
          // null, and the old check let the panel open for a signed-out visitor
          // who then hit the database and got an RLS error in the face.
          if (!supabase || signedIn !== true) {
            router.push(signInHref())
            return
          }
          setOpen((v) => !v)
        }}
        className={
          tone === 'pan'
            ? 'chip !border-milk/40 !text-milk hover:!border-flame data-[in=true]:!border-flame data-[in=true]:!text-flame'
            : 'chip data-[in=true]:!border-flame data-[in=true]:!text-flame'
        }
        data-in={inWeek}
        aria-expanded={open}
      >
        {inWeek ? `✓ In week (${planned.length})` : '+ Plan'}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-[17rem] rounded-md border border-ink/30 bg-card p-3.5 text-ink shadow-(--shadow-block)">
          <p className="eyebrow m-0">Which meal?</p>
          <div className="mt-2 flex gap-1.5">
            {MEAL_ORDER.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeal(m)}
                aria-pressed={meal === m}
                className="flex-1 cursor-pointer rounded border border-rule bg-transparent px-1 py-1.5 font-mono text-[0.6875rem] font-medium text-ink transition-colors hover:border-flame aria-pressed:border-flame aria-pressed:bg-flame/10 aria-pressed:text-flame"
              >
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>

          <p className="eyebrow m-0 mt-3">Tap a day to add or remove</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {WEEKDAYS.map((label, day) => {
              const on = planned.some((p) => p.day === day && p.meal === meal)
              return (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  onClick={() => void toggle(day)}
                  data-added={on}
                  className="cursor-pointer rounded border border-rule bg-transparent px-1 py-1.5 font-mono text-[0.75rem] font-medium text-ink transition-colors hover:border-flame disabled:opacity-50 data-[added=true]:border-flame data-[added=true]:bg-flame/10 data-[added=true]:text-flame"
                >
                  {on ? '✓ ' : ''}
                  {label}
                </button>
              )
            })}
          </div>

          {error && (
            <p className="mt-2 mb-0 font-mono text-[0.6875rem] leading-snug text-heat" role="alert">
              Couldn’t update your plan: {error}
            </p>
          )}

          <Link
            href="/plan"
            className="mt-3 block font-mono text-[0.75rem] tracking-[0.1em] text-flame uppercase underline-offset-4 hover:underline"
          >
            View your week →
          </Link>
        </div>
      )}
    </div>
  )
}
