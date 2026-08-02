'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Fixed coordinates rather than absolute offsets: the recipe hero is
  // overflow-hidden for its image treatment, so an absolutely-positioned panel
  // was sliced off at the hero's bottom edge — the day grid literally
  // disappeared mid-row. A portal escapes the clip; these coords put it back
  // under the button.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const W = 272 // w-[17rem]
    const H = 300 // generous upper bound for the panel
    const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8)
    // Flip above the trigger when the viewport has no room below it.
    const below = r.bottom + 8
    const top = below + H > window.innerHeight - 8 ? Math.max(8, r.top - H - 8) : below
    setPos({ left, top })
  }

  useEffect(() => {
    if (!open) return
    place()
    // Scroll and resize both move the trigger out from under a fixed panel.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

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
      const t = e.target as Node
      // The panel is portalled to <body>, so containment in rootRef is no
      // longer enough to know the click was "inside".
      if (rootRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
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
        ref={triggerRef}
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
        title={signedIn === false ? 'Sign in to add this to your week' : undefined}
      >
        {/* Signed out, say so before the click rather than after the redirect. */}
        {signedIn === false ? 'Sign in to plan' : inWeek ? `✓ In week (${planned.length})` : '+ Plan'}
      </button>

      {open &&
        pos !== null &&
        createPortal(
        <div
          ref={panelRef}
          style={{ left: pos.left, top: pos.top }}
          className="fixed z-[70] w-[17rem] rounded-md border border-ink/30 bg-card p-3.5 text-ink shadow-(--shadow-block)"
        >
          <p className="eyebrow m-0">Which meal?</p>
          <div className="mt-2 flex gap-1.5">
            {MEAL_ORDER.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeal(m)}
                aria-pressed={meal === m}
                className="flex-1 cursor-pointer rounded border border-rule bg-transparent px-1 py-1.5 font-mono text-tag font-medium text-ink transition-colors hover:border-flame aria-pressed:border-flame aria-pressed:bg-flame/10 aria-pressed:text-flame"
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
                  className="cursor-pointer rounded border border-rule bg-transparent px-1 py-1.5 font-mono text-caption font-medium text-ink transition-colors hover:border-flame disabled:opacity-50 data-[added=true]:border-flame data-[added=true]:bg-flame/10 data-[added=true]:text-flame"
                >
                  {on ? '✓ ' : ''}
                  {label}
                </button>
              )
            })}
          </div>

          {error && (
            <p className="mt-2 mb-0 font-mono text-tag leading-snug text-heat" role="alert">
              Couldn’t update your plan: {error}
            </p>
          )}

          <Link
            href="/plan"
            className="mt-3 block font-mono text-caption tracking-[0.1em] text-flame uppercase underline-offset-4 hover:underline"
          >
            View your week →
          </Link>
        </div>,
          document.body,
        )}
    </div>
  )
}
