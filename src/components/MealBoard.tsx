'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { supabaseBrowser, WEEKDAYS } from '@/lib/supabase/client'

type BoardEntry = { id: string; day: number; slug: string; title: string; image: string | null }

/** The weekly board: recipes per day, each removable. Deletes write to Supabase. */
export function MealBoard({ entries }: { entries: BoardEntry[] }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const remove = async (id: string) => {
    if (!supabase) return
    setBusy(id)
    try {
      const { error } = await supabase.from('meal_plan').delete().eq('id', id)
      if (!error) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-3">
      {WEEKDAYS.map((label, day) => {
        const dayEntries = entries.filter((e) => e.day === day)
        return (
          <div key={label} className="grid grid-cols-[3.5rem_1fr] gap-3 border-t border-rule pt-3">
            <span className="eyebrow pt-1">{label}</span>
            <div className="grid gap-2">
              {dayEntries.length === 0 ? (
                <span className="text-[0.875rem] text-slate/60">—</span>
              ) : (
                dayEntries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded border border-rule p-2">
                    {e.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail
                      <img src={e.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                    )}
                    <Link
                      href={`/recipes/${e.slug}`}
                      className="min-w-0 flex-1 truncate text-[0.9375rem] no-underline hover:text-flame"
                    >
                      {e.title}
                    </Link>
                    <button
                      type="button"
                      disabled={busy === e.id}
                      onClick={() => void remove(e.id)}
                      aria-label={`Remove ${e.title}`}
                      className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-slate transition-colors hover:border-heat hover:text-heat disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
