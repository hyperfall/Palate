'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { MEAL_LABELS, MEAL_ORDER, type MealType } from '@/lib/mealPlan'
import { supabaseBrowser, WEEKDAYS } from '@/lib/supabase/client'

/**
 * Add-to-week, on a recipe. Signed out (or unconfigured), routes to /account.
 * Signed in, opens a day picker; tapping a weekday inserts a meal_plan row
 * (user_id defaults to auth.uid() in the schema). Mirrors SaveRecipe.
 */
export function AddToPlan({ slug, title, image }: { slug: string; title: string; image: string | null }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [meal, setMeal] = useState<MealType>('dinner')
  const [added, setAdded] = useState<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth
      .getUser()
      .then(({ data }) => setSignedIn(Boolean(data.user)))
      .catch(() => setSignedIn(false))
  }, [supabase])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const add = async (day: number) => {
    if (!supabase || busy) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('meal_plan')
        .insert({ day, meal, recipe_slug: slug, recipe_title: title, recipe_image: image })
      if (!error) setAdded((prev) => new Set(prev).add(`${day}:${meal}`))
    } finally {
      setBusy(false)
    }
  }

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
        className="chip !border-milk/40 !text-milk hover:!border-flame"
        aria-expanded={open}
      >
        + Plan
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

          <p className="eyebrow m-0 mt-3">Which day?</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {WEEKDAYS.map((label, day) => {
              const key = `${day}:${meal}`
              return (
                <button
                  key={label}
                  type="button"
                  disabled={busy}
                  onClick={() => void add(day)}
                  data-added={added.has(key)}
                  className="cursor-pointer rounded border border-rule bg-transparent px-1 py-1.5 font-mono text-[0.75rem] font-medium text-ink transition-colors hover:border-flame disabled:opacity-50 data-[added=true]:border-flame data-[added=true]:text-flame"
                >
                  {added.has(key) ? '✓ ' : ''}
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
