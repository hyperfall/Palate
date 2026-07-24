'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { MEAL_LABELS, MEAL_ORDER, normalizeMeal, type MealType } from '@/lib/mealPlan'
import { supabaseBrowser, WEEKDAYS } from '@/lib/supabase/client'

type Planned = { id: string; day: number; meal: MealType }

/**
 * Week-aware add-to-plan on a recipe. Signed out (or unconfigured), routes to
 * /account. Signed in, it loads where this recipe already sits in the week and
 * lets you toggle it on/off per day + meal — so the recipe page reflects the
 * plan rather than firing blind inserts.
 */
export function AddToPlan({ slug, title, image }: { slug: string; title: string; image: string | null }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [meal, setMeal] = useState<MealType>('dinner')
  const [planned, setPlanned] = useState<Planned[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        setSignedIn(Boolean(data.user))
        if (!data.user) return
        // Scope to the shared week when in a household, else personal rows.
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .maybeSingle()
        const householdId = (membership?.household_id as string | undefined) ?? null
        const base = supabase.from('meal_plan').select('id,day,meal').eq('recipe_slug', slug)
        const scoped = householdId ? base.eq('household_id', householdId) : base.is('household_id', null)
        const { data: rows } = await scoped
        setPlanned(
          (rows ?? []).map((r) => ({ id: r.id as string, day: r.day as number, meal: normalizeMeal(r.meal as string) })),
        )
      })
      .catch(() => setSignedIn(false))
  }, [supabase, slug])

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
    setBusy(true)
    try {
      const existing = planned.find((p) => p.day === day && p.meal === meal)
      if (existing) {
        const { error } = await supabase.from('meal_plan').delete().eq('id', existing.id)
        if (!error) setPlanned((prev) => prev.filter((p) => p.id !== existing.id))
      } else {
        const { data, error } = await supabase
          .from('meal_plan')
          .insert({ day, meal, recipe_slug: slug, recipe_title: title, recipe_image: image })
          .select('id')
          .single()
        if (!error && data) setPlanned((prev) => [...prev, { id: data.id as string, day, meal }])
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
          if (!supabase || signedIn === false) {
            router.push('/account')
            return
          }
          setOpen((v) => !v)
        }}
        className="chip !border-milk/40 !text-milk hover:!border-flame data-[in=true]:!border-flame data-[in=true]:!text-flame"
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
