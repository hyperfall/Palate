'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

import type { WeekShoppingList } from '@/lib/mealPlan'

/**
 * The button that opens shopping mode, and nothing else.
 *
 * The aisle checklist behind it carries a wake lock, live household sync and a
 * pantry write — none of which a planner needs until they are standing in a
 * shop. Splitting it keeps that weight off the plan page's first load.
 */
const ShoppingMode = dynamic(
  () => import('@/components/ShoppingModeDialog').then((m) => m.ShoppingMode),
  { ssr: false },
)

export function ShoppingModeLauncher({ list }: { list: WeekShoppingList }) {
  const [open, setOpen] = useState(false)
  if (list.netted.length === 0) return null

  return (
    <div className="mt-5">
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full sm:w-auto">
        Shopping mode →
      </button>
      {open && <ShoppingMode list={list} onClose={() => setOpen(false)} />}
    </div>
  )
}
