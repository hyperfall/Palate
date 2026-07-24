'use client'

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { MEAL_LABELS, MEAL_ORDER, normalizeMeal, type MealType } from '@/lib/mealPlan'
import { supabaseBrowser, WEEKDAYS } from '@/lib/supabase/client'

type BoardEntry = { id: string; day: number; meal: string; slug: string; title: string; image: string | null }

const mealIndex = (m: string) => MEAL_ORDER.indexOf(normalizeMeal(m))

/**
 * The weekly board: a responsive 7-column week grid (stacked list on narrow
 * screens) with drag-to-reorder. Drag a dish by its handle to reorder within a
 * day or move it to another day; the meal slot is inferred from where it lands.
 * Changes persist to Supabase optimistically. Deletes remove the row.
 */
export function MealBoard({ entries: initial }: { entries: BoardEntry[] }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [entries, setEntries] = useState<BoardEntry[]>(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Re-sync when the server sends fresh data (e.g. after add/remove elsewhere).
  useEffect(() => setEntries(initial), [initial])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Per-day, display-ordered dishes (meals in canonical order; position within).
  const byDay = useMemo(() => {
    const map = new Map<number, BoardEntry[]>()
    for (let d = 0; d < 7; d++) map.set(d, [])
    for (const e of entries) if (e.day >= 0 && e.day < 7) map.get(e.day)!.push(e)
    for (const list of map.values()) list.sort((a, b) => mealIndex(a.meal) - mealIndex(b.meal))
    return map
  }, [entries])

  const remove = async (id: string) => {
    if (!supabase) return
    setBusy(id)
    try {
      const { error } = await supabase.from('meal_plan').delete().eq('id', id)
      if (!error) setEntries((prev) => prev.filter((e) => e.id !== id))
    } finally {
      setBusy(null)
    }
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const movedId = String(active.id)
    const moved = entries.find((x) => x.id === movedId)
    if (!moved) return

    const overId = String(over.id)

    // Resolve the target day + insertion index.
    let targetDay: number
    let list: BoardEntry[]
    let index: number
    if (overId.startsWith('day-')) {
      targetDay = Number(overId.slice(4))
      list = (byDay.get(targetDay) ?? []).filter((x) => x.id !== movedId)
      index = list.length
    } else {
      const overEntry = entries.find((x) => x.id === overId)
      if (!overEntry) return
      targetDay = overEntry.day
      list = (byDay.get(targetDay) ?? []).filter((x) => x.id !== movedId)
      index = list.findIndex((x) => x.id === overId)
      if (index < 0) index = list.length
    }

    list.splice(index, 0, moved)
    const above = list[index - 1]
    const below = list[index + 1]
    const newMeal: MealType = above ? normalizeMeal(above.meal) : below ? normalizeMeal(below.meal) : normalizeMeal(moved.meal)

    // Compute new day/meal/position for every affected row.
    const updates = new Map<string, { day: number; meal: MealType; position: number }>()
    list.forEach((x, i) => updates.set(x.id, { day: targetDay, meal: x.id === movedId ? newMeal : normalizeMeal(x.meal), position: i }))
    if (moved.day !== targetDay) {
      ;(byDay.get(moved.day) ?? [])
        .filter((x) => x.id !== movedId)
        .forEach((x, i) => updates.set(x.id, { day: moved.day, meal: normalizeMeal(x.meal), position: i }))
    }

    setEntries((prev) => prev.map((x) => (updates.has(x.id) ? { ...x, ...updates.get(x.id)! } : x)))

    if (!supabase) return
    setBusy(movedId)
    try {
      const results = await Promise.all(
        [...updates.entries()].map(([id, u]) => supabase.from('meal_plan').update(u).eq('id', id)),
      )
      // If anything failed, fall back to server truth rather than a wrong order.
      if (results.some((r) => r.error)) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const activeEntry = activeId ? entries.find((e) => e.id === activeId) ?? null : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid gap-x-4 gap-y-0 xl:grid-cols-7">
        {WEEKDAYS.map((label, day) => (
          <DayColumn key={label} day={day} label={label} dishes={byDay.get(day) ?? []} busy={busy} onRemove={remove} />
        ))}
      </div>
      <DragOverlay>{activeEntry ? <DishCard entry={activeEntry} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}

function DayColumn({
  day,
  label,
  dishes,
  busy,
  onRemove,
}: {
  day: number
  label: string
  dishes: BoardEntry[]
  busy: string | null
  onRemove: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })
  const empty = dishes.length === 0

  return (
    <section
      className={`border-t border-rule py-3 xl:border-t-0 xl:py-0 ${empty ? '' : ''} first:border-t-2 first:border-ink xl:first:border-t-0`}
    >
      <div className="flex items-baseline justify-between gap-2 xl:border-b-2 xl:border-ink xl:pb-1.5">
        <span
          className={`font-mono text-[0.8125rem] font-semibold tracking-[0.12em] uppercase ${empty ? 'text-slate/50' : 'text-flame'}`}
        >
          {label}
        </span>
        {empty ? (
          <span className="font-mono text-[0.6875rem] tracking-[0.1em] text-slate/40 uppercase">Open</span>
        ) : (
          <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">{dishes.length}</span>
        )}
      </div>

      <SortableContext items={dishes.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`mt-2 grid gap-2 rounded-md transition-colors xl:min-h-[6rem] ${
            isOver ? 'bg-flame/5 outline-2 outline-dashed outline-flame/40' : ''
          } ${empty ? 'min-h-[2.5rem]' : ''}`}
        >
          {dishes.map((d, i) => {
            const showMeal = i === 0 || mealIndex(d.meal) !== mealIndex(dishes[i - 1].meal)
            return (
              <div key={d.id}>
                {showMeal && (
                  <p className="mt-1 mb-1 font-mono text-[0.625rem] font-medium tracking-[0.14em] text-slate uppercase">
                    {MEAL_LABELS[normalizeMeal(d.meal)]}
                  </p>
                )}
                <DishItem entry={d} busy={busy === d.id} onRemove={onRemove} />
              </div>
            )
          })}
          {empty && (
            <p className="grid place-items-center py-2 font-mono text-[0.6875rem] tracking-[0.08em] text-slate/30 uppercase">
              Drop here
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

function DishItem({ entry, busy, onRemove }: { entry: BoardEntry; busy: boolean; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-2 rounded-md border border-rule bg-card p-2 transition-colors hover:border-flame/40">
      <button
        type="button"
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab touch-none px-0.5 text-slate/50 hover:text-flame active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </svg>
      </button>
      {entry.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail
        <img src={entry.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      ) : (
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded border border-dashed border-rule bg-wash text-slate/40">
          ◵
        </span>
      )}
      <Link href={`/recipes/${entry.slug}`} className="min-w-0 flex-1 truncate text-[0.9375rem] leading-tight text-ink no-underline group-hover:text-flame">
        {entry.title}
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => onRemove(entry.id)}
        aria-label={`Remove ${entry.title}`}
        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-[0.75rem] text-slate transition-colors hover:border-heat hover:text-heat disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  )
}

/** Presentational card, reused by the drag overlay. */
function DishCard({ entry, dragging = false }: { entry: BoardEntry; dragging?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border bg-card p-2 ${dragging ? 'border-flame shadow-block' : 'border-rule'}`}>
      <span className="shrink-0 px-0.5 text-flame">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </svg>
      </span>
      {entry.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail
        <img src={entry.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
      ) : (
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded border border-dashed border-rule bg-wash text-slate/40">◵</span>
      )}
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink">{entry.title}</span>
    </div>
  )
}
