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

type BoardEntry = {
  id: string
  day: number
  meal: string
  slug: string
  title: string
  image: string | null
  servings: number
  baseServings: number
}

const slotId = (day: number, meal: MealType) => `slot-${day}-${meal}`
/** Parse `slot-<day>-<meal>` (meal may itself be a single token). */
function parseSlot(id: string): { day: number; meal: MealType } | null {
  if (!id.startsWith('slot-')) return null
  const rest = id.slice(5)
  const dash = rest.indexOf('-')
  if (dash < 0) return null
  return { day: Number(rest.slice(0, dash)), meal: normalizeMeal(rest.slice(dash + 1)) }
}

/**
 * The weekly board: a responsive 7-column week grid (stacked list on narrow
 * screens) laid out as a Breakfast/Lunch/Dinner timetable. Drag a dish by its
 * handle into any meal slot of any day — the slot you drop into sets its day and
 * meal; order within a slot is preserved. Changes persist to Supabase
 * optimistically. Deletes remove the row.
 */
export function MealBoard({ entries: initial }: { entries: BoardEntry[] }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [entries, setEntries] = useState<BoardEntry[]>(initial)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => setEntries(initial), [initial])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Dishes per (day, meal) slot, ordered by position.
  const slots = useMemo(() => {
    const map = new Map<string, BoardEntry[]>()
    for (const e of entries) {
      if (e.day < 0 || e.day > 6) continue
      const key = `${e.day}:${normalizeMeal(e.meal)}`
      ;(map.get(key) ?? map.set(key, []).get(key)!).push(e)
    }
    return map
  }, [entries])

  const slotList = (day: number, meal: MealType) => slots.get(`${day}:${meal}`) ?? []
  const dayCount = (day: number) => MEAL_ORDER.reduce((n, m) => n + slotList(day, m).length, 0)

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

  // Set the planned servings for a dish (clamped, persisted optimistically).
  const setServings = async (id: string, next: number) => {
    const v = Math.max(1, Math.min(99, Math.round(next)))
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, servings: v } : e)))
    if (!supabase) return
    const { error } = await supabase.from('meal_plan').update({ servings: v }).eq('id', id)
    if (error) router.refresh()
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const movedId = String(active.id)
    const moved = entries.find((x) => x.id === movedId)
    if (!moved) return

    // Resolve the target slot + insertion index (dropped on a slot or a dish).
    const overId = String(over.id)
    let targetDay: number
    let targetMeal: MealType
    let index: number
    const asSlot = parseSlot(overId)
    if (asSlot) {
      targetDay = asSlot.day
      targetMeal = asSlot.meal
      index = slotList(targetDay, targetMeal).filter((x) => x.id !== movedId).length
    } else {
      const overEntry = entries.find((x) => x.id === overId)
      if (!overEntry) return
      targetDay = overEntry.day
      targetMeal = normalizeMeal(overEntry.meal)
      const list = slotList(targetDay, targetMeal).filter((x) => x.id !== movedId)
      index = list.findIndex((x) => x.id === overId)
      if (index < 0) index = list.length
    }

    const fromMeal = normalizeMeal(moved.meal)
    const sameSlot = moved.day === targetDay && fromMeal === targetMeal

    const targetOrder = slotList(targetDay, targetMeal).filter((x) => x.id !== movedId)
    targetOrder.splice(index, 0, moved)

    const updates = new Map<string, { day: number; meal: MealType; position: number }>()
    targetOrder.forEach((x, i) =>
      updates.set(x.id, { day: targetDay, meal: x.id === movedId ? targetMeal : normalizeMeal(x.meal), position: i }),
    )
    if (!sameSlot) {
      slotList(moved.day, fromMeal)
        .filter((x) => x.id !== movedId)
        .forEach((x, i) => updates.set(x.id, { day: moved.day, meal: fromMeal, position: i }))
    }

    setEntries((prev) => prev.map((x) => (updates.has(x.id) ? { ...x, ...updates.get(x.id)! } : x)))

    if (!supabase) return
    setBusy(movedId)
    try {
      const results = await Promise.all(
        [...updates.entries()].map(([id, u]) => supabase.from('meal_plan').update(u).eq('id', id)),
      )
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
          <section
            key={label}
            className="min-w-0 border-t border-rule py-3 first:border-t-2 first:border-ink xl:border-t-0 xl:py-0 xl:first:border-t-0"
          >
            <div className="flex items-baseline justify-between gap-2 xl:border-b-2 xl:border-ink xl:pb-1.5">
              <span
                className={`font-mono text-[0.8125rem] font-semibold tracking-[0.12em] uppercase ${
                  dayCount(day) === 0 ? 'text-slate/50' : 'text-flame'
                }`}
              >
                {label}
              </span>
              {dayCount(day) > 0 && (
                <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">{dayCount(day)}</span>
              )}
            </div>

            <div className="mt-2 grid gap-2.5">
              {MEAL_ORDER.map((meal) => (
                <MealSlot
                  key={meal}
                  day={day}
                  meal={meal}
                  dishes={slotList(day, meal)}
                  busy={busy}
                  dragging={activeId !== null}
                  onRemove={remove}
                  onServings={setServings}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <DragOverlay>{activeEntry ? <DishCard entry={activeEntry} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}

function MealSlot({
  day,
  meal,
  dishes,
  busy,
  dragging,
  onRemove,
  onServings,
}: {
  day: number
  meal: MealType
  dishes: BoardEntry[]
  busy: string | null
  dragging: boolean
  onRemove: (id: string) => void
  onServings: (id: string, next: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(day, meal) })
  const empty = dishes.length === 0

  // On phones the 3-per-day timetable is long, so empty slots are hidden and
  // only revealed while dragging (they must stay droppable then). Desktop's
  // calendar always shows all three.
  return (
    <div className={`min-w-0 ${empty && !dragging ? 'max-xl:hidden' : ''}`}>
      <p className="m-0 font-mono text-[0.625rem] font-medium tracking-[0.14em] text-slate/70 uppercase">
        {MEAL_LABELS[meal]}
      </p>
      <SortableContext items={dishes.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`mt-1 grid gap-2 rounded-md transition-colors ${
            isOver ? 'bg-flame/5 outline-2 outline-dashed outline-flame/50' : ''
          } ${empty ? 'min-h-[2.25rem] place-content-center' : ''}`}
        >
          {empty ? (
            <span
              className={`text-center font-mono text-[0.625rem] tracking-[0.1em] uppercase ${
                isOver ? 'text-flame' : 'text-slate/25'
              }`}
            >
              {isOver ? 'Drop' : '·'}
            </span>
          ) : (
            dishes.map((d) => (
              <DishItem key={d.id} entry={d} busy={busy === d.id} onRemove={onRemove} onServings={onServings} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function DishItem({
  entry,
  busy,
  onRemove,
  onServings,
}: {
  entry: BoardEntry
  busy: boolean
  onRemove: (id: string) => void
  onServings: (id: string, next: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex min-w-0 items-center gap-2 rounded-md border border-rule bg-card p-1.5 transition-colors hover:border-flame/50"
    >
      {/* The thumbnail IS the drag handle — a natural grab target that costs the
          title no width (the old grip column left titles truncating in a 154px
          column). touch-none is scoped to it so the card still scrolls on a phone. */}
      <button
        type="button"
        aria-label={`Drag ${entry.title} to reorder`}
        className="relative h-10 w-10 shrink-0 cursor-grab touch-none overflow-hidden rounded border-none bg-wash p-0 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {entry.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail
          <img src={entry.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="grid h-full w-full place-items-center text-slate/40">
            ◵
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-pan-deep/55 text-milk opacity-0 transition-opacity group-hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/recipes/${entry.slug}`}
          className="line-clamp-2 text-[0.8125rem] leading-[1.25] text-ink no-underline group-hover:text-flame"
        >
          {entry.title}
        </Link>

        {/* Meta line: servings, then remove at the far end — no absolute corner
            button, so nothing has to reserve padding away from the title. */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onServings(entry.id, entry.servings - 1)}
            disabled={entry.servings <= 1}
            aria-label="Fewer servings"
            title="Fewer servings"
            className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full border border-rule bg-transparent font-mono text-[0.6875rem] leading-none text-slate transition-colors hover:border-flame hover:text-flame disabled:opacity-30"
          >
            −
          </button>
          <span
            title={`Serves ${entry.servings}`}
            aria-label={`Serves ${entry.servings}`}
            className="min-w-[0.75rem] text-center font-mono text-[0.6875rem] font-medium tabular-nums text-flame"
          >
            {entry.servings}
          </span>
          <button
            type="button"
            onClick={() => onServings(entry.id, entry.servings + 1)}
            aria-label="More servings"
            title="More servings"
            className="grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full border border-rule bg-transparent font-mono text-[0.6875rem] leading-none text-slate transition-colors hover:border-flame hover:text-flame"
          >
            +
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(entry.id)}
            aria-label={`Remove ${entry.title}`}
            className="ml-auto grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded border-none bg-transparent font-mono text-[0.625rem] text-slate/50 transition-colors hover:text-heat disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

/** Presentational card, reused by the drag overlay. */
function DishCard({ entry, dragging = false }: { entry: BoardEntry; dragging?: boolean }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-md border bg-card p-1.5 ${dragging ? 'border-flame shadow-block' : 'border-rule'}`}
    >
      <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-wash">
        {entry.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail
          <img src={entry.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="grid h-full w-full place-items-center text-slate/40">
            ◵
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-[0.8125rem] leading-[1.25] text-ink">{entry.title}</span>
        <span className="font-mono text-[0.6875rem] font-medium tabular-nums text-flame">
          {entry.servings}
        </span>
      </div>
    </div>
  )
}
