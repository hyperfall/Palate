import { humanizeQuantity } from './units'

/**
 * Meal-plan math: turn a week of planned recipes into one consolidated shopping
 * list that NETS overlapping ingredients — two recipes needing garlic become a
 * single line with the quantities summed — and drops anything already in the
 * pantry. This is the payoff of the canonical-ingredient backbone: netting keys
 * on the canonical id, not the freeform text, so "garlic cloves" and "minced
 * garlic" combine. Pure; no I/O.
 */
export type PlanIngredient = {
  quantity?: string | null
  unit?: string | null
  item: string
  canonicalId?: number | null
  canonicalName?: string | null
}
export type PlanRecipe = { title: string; ingredients: PlanIngredient[] }
export type ShoppingLine = { key: string; name: string; amounts: string[]; recipes: string[] }
export type Pantry = { ids: Set<number>; names: Set<string> }

const EMPTY_PANTRY: Pantry = { ids: new Set(), names: new Set() }

export function consolidateShoppingList(recipes: PlanRecipe[], pantry: Pantry = EMPTY_PANTRY): ShoppingLine[] {
  const groups = new Map<
    string,
    { name: string; numeric: Map<string, number>; freeform: Set<string>; recipes: Set<string> }
  >()

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const name = (ing.canonicalName ?? ing.item).trim()
      if (!name) continue
      const id = ing.canonicalId ?? null
      const lname = name.toLowerCase()
      // Already in the pantry (on-hand or a ticked staple) — never re-list.
      if ((id !== null && pantry.ids.has(id)) || pantry.names.has(lname)) continue

      const key = id !== null ? `id:${id}` : `name:${lname}`
      let g = groups.get(key)
      if (!g) {
        g = { name, numeric: new Map(), freeform: new Set(), recipes: new Set() }
        groups.set(key, g)
      }
      g.recipes.add(recipe.title)

      const qty = ing.quantity ? Number.parseFloat(ing.quantity) : Number.NaN
      const unit = (ing.unit ?? '').trim()
      if (!Number.isNaN(qty)) {
        // Sum per unit — different units can't be added, so they stay separate.
        g.numeric.set(unit, (g.numeric.get(unit) ?? 0) + qty)
      } else if (ing.quantity || ing.unit) {
        g.freeform.add([ing.quantity, ing.unit].filter(Boolean).join(' '))
      }
    }
  }

  const lines: ShoppingLine[] = []
  for (const [key, g] of groups) {
    const amounts: string[] = []
    for (const [unit, sum] of g.numeric) {
      amounts.push([humanizeQuantity(sum), unit].filter(Boolean).join(' '))
    }
    amounts.push(...g.freeform)
    lines.push({ key, name: g.name, amounts, recipes: [...g.recipes] })
  }
  lines.sort((a, b) => a.name.localeCompare(b.name))
  return lines
}

/** Estimated cost of a planned week: sums costPerServing × servings where known. */
export function weeklyCost(
  recipes: Array<{ costPerServing?: number | null; servings?: number | null }>,
): { totalCents: number; covered: number; total: number } {
  let totalCents = 0
  let covered = 0
  for (const r of recipes) {
    if (typeof r.costPerServing === 'number' && r.costPerServing > 0) {
      totalCents += r.costPerServing * (r.servings ?? 1)
      covered++
    }
  }
  return { totalCents, covered, total: recipes.length }
}

// --- The shareable week snapshot -------------------------------------------
//
// A share must capture the week's *structure* (which dish on which day), not a
// flat slug list, so the card renders faithfully and stays immutable even if
// the planner later changes their week.

/** Monday-first day labels; a plan entry's `day` is 0 (Mon) … 6 (Sun). */
export const WEEK_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Meal slots within a day, in the order they're served. */
export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'] as const
export type MealType = (typeof MEAL_ORDER)[number]
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}
/** An entry with no/unknown meal is treated as dinner (the default plan slot). */
export const normalizeMeal = (m?: string | null): MealType =>
  (MEAL_ORDER as readonly string[]).includes(m ?? '') ? (m as MealType) : 'dinner'

export type WeekDish = { slug: string; title: string; image: string | null }
export type WeekMeal = { meal: MealType; dishes: WeekDish[] }
/** A day carries only the meals that actually have dishes, in MEAL_ORDER. */
export type WeekDaySlot = { day: number; meals: WeekMeal[] }
export type WeekSnapshot = {
  title: string | null
  weekOf: string | null
  days: WeekDaySlot[]
}

/** Group flat plan entries into a fixed 7-day snapshot (Mon…Sun) → meals →
 *  dishes, everything ordered (day, then MEAL_ORDER, then position). Out-of-range
 *  days are dropped; a day with no dishes is an empty `meals: []`. */
export function buildWeekSnapshot(
  entries: Array<{
    day: number
    meal?: string | null
    slug: string
    title: string
    image: string | null
    position: number
  }>,
  meta: { title?: string | null; weekOf?: string | null } = {},
): WeekSnapshot {
  const byDay = new Map<number, Map<MealType, WeekDish[]>>()
  for (const e of [...entries].sort((a, b) => a.day - b.day || a.position - b.position)) {
    if (e.day < 0 || e.day > 6) continue
    const meal = normalizeMeal(e.meal)
    if (!byDay.has(e.day)) byDay.set(e.day, new Map())
    const meals = byDay.get(e.day)!
    if (!meals.has(meal)) meals.set(meal, [])
    meals.get(meal)!.push({ slug: e.slug, title: e.title, image: e.image })
  }
  return {
    title: meta.title ?? null,
    weekOf: meta.weekOf ?? null,
    days: Array.from({ length: 7 }, (_, day) => {
      const meals = byDay.get(day)
      return {
        day,
        meals: meals ? MEAL_ORDER.filter((m) => meals.has(m)).map((m) => ({ meal: m, dishes: meals.get(m)! })) : [],
      }
    }),
  }
}

export const weekDishCount = (w: WeekSnapshot): number =>
  w.days.reduce((n, d) => n + d.meals.reduce((k, m) => k + m.dishes.length, 0), 0)
