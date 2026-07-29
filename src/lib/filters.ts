import {
  COURSES,
  DIETARY_TAGS,
  DIFFICULTIES,
  MAIN_INGREDIENTS,
  TASTE_AXES,
  type TasteAxis,
} from './taxonomy'
import { parseVector, encodeVector, type TasteVector } from './tasteProfile'

/**
 * Catalog filter state lives entirely in the URL (design spec §7: "filter state
 * in the URL (shareable, SEO-friendly)"). This module is the single translation
 * point between query strings and Payload `where` clauses — nothing else parses
 * search params by hand.
 *
 * Taste axes are RANGES, not ceilings. `spiciness=3-5` means "at least hot" —
 * the thing a ceiling-only model could never say, even though it's the most
 * natural request a cook makes. The encoding is `min-max`; a bare number is
 * accepted as a legacy ceiling (`spiciness=2` ≡ `0-2`) so previously shared
 * URLs keep meaning what they meant.
 */

export type SortKey = 'newest' | 'quickest' | 'cheapest' | 'top' | 'foryou' | TasteAxis

export type TasteRange = { min: number; max: number }

export type CatalogFilters = {
  cuisines: string[]
  courses: string[]
  ingredients: string[]
  diets: string[]
  difficulties: string[]
  /** Per-axis inclusive range on the 0–5 scale. Absent = unconstrained. */
  taste: Partial<Record<TasteAxis, TasteRange>>
  maxMinutes: number | null
  /** Per-serving calorie ceiling. Absent = unconstrained. */
  maxCalories: number | null
  /** Minimum rating (on the 0–5 scale). Absent = unconstrained. */
  minRating: number | null
  /** Per-serving cost ceiling in cents. Absent = unconstrained. */
  maxCost: number | null
  /** Required equipment tags (additive — a recipe must carry all selected). */
  equipment: string[]
  onePan: boolean
  makeAhead: boolean
  /** Keeps/reheats well (finish.storageDays ≥ 2). */
  keepsWell: boolean
  /** Saved taste profile, for the "For your taste" sort. Absent = no profile. */
  tasteVector: TasteVector | null
  /** Free-text search over recipe titles. */
  q: string
  page: number
  sort: SortKey
}

export type RawSearchParams = Record<string, string | string[] | undefined>

const DIET_VALUES = new Set(DIETARY_TAGS.map((d) => d.value))
const DIFFICULTY_VALUES = new Set(DIFFICULTIES.map((d) => d.value))
const COURSE_VALUES = new Set(COURSES.map((c) => c.value))
const INGREDIENT_VALUES = new Set(MAIN_INGREDIENTS.map((i) => i.value))
/** Per-serving calorie slider bounds. At/above the max means "no ceiling". */
export const CALORIE_MIN = 100
export const CALORIE_MAX = 1200
export const CALORIE_STEP = 50
const SORT_VALUES = new Set<string>(['newest', 'quickest', 'cheapest', 'top', 'foryou', ...TASTE_AXES])

/** The rating thresholds the catalog offers as filter chips. */
export const RATING_CHOICES = [3, 4, 4.5] as const

/** Equipment values a recipe may require (mirrors the schema select). */
export const EQUIPMENT_VALUES = new Set<string>([
  'stovetop', 'oven', 'microwave', 'grill', 'blender', 'food-processor', 'slow-cooker', 'air-fryer', 'no-cook',
])

/** Parses a `rating` param into an allowed threshold, or null when unconstrained/invalid. */
export function parseMinRating(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0 || n > 5) return null
  return n
}

export const AXIS_MIN = 0
export const AXIS_MAX = 5

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function asList(value: string | string[] | undefined): string[] {
  if (!value) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
}

function clampLevel(n: number): number {
  return Math.max(AXIS_MIN, Math.min(AXIS_MAX, Math.round(n)))
}

/** Parses `a-b` (range) or `n` (legacy ceiling ≡ `0-n`). Null when unconstrained or malformed. */
export function parseTasteRange(raw: string | undefined): TasteRange | null {
  if (raw === undefined || raw === '') return null

  const rangeMatch = raw.match(/^(\d+)-(\d+)$/)
  const single = rangeMatch ? null : Number.parseInt(raw, 10)

  let min: number
  let max: number
  if (rangeMatch) {
    min = clampLevel(Number.parseInt(rangeMatch[1], 10))
    max = clampLevel(Number.parseInt(rangeMatch[2], 10))
    if (min > max) [min, max] = [max, min]
  } else if (single !== null && !Number.isNaN(single)) {
    min = AXIS_MIN
    max = clampLevel(single)
  } else {
    return null
  }

  // The full scale constrains nothing — drop it so "any" is indistinguishable
  // from absent and URLs stay clean.
  if (min === AXIS_MIN && max === AXIS_MAX) return null
  return { min, max }
}

export function encodeTasteRange(range: TasteRange): string {
  return `${range.min}-${range.max}`
}

export function parseFilters(params: RawSearchParams): CatalogFilters {
  const taste: Partial<Record<TasteAxis, TasteRange>> = {}
  for (const axis of TASTE_AXES) {
    const range = parseTasteRange(first(params[axis]))
    if (range) taste[axis] = range
  }

  const sortParam = first(params.sort)
  const timeParam = first(params.time)
  const parsedTime = timeParam ? Number.parseInt(timeParam, 10) : Number.NaN
  const kcalParam = first(params.kcal)
  const parsedKcal = kcalParam ? Number.parseInt(kcalParam, 10) : Number.NaN
  const pageParam = first(params.page)
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 1

  return {
    cuisines: asList(params.cuisine),
    courses: asList(params.course).filter((c) => COURSE_VALUES.has(c as never)),
    ingredients: asList(params.ingredient).filter((i) => INGREDIENT_VALUES.has(i as never)),
    diets: asList(params.diet).filter((d) => DIET_VALUES.has(d as never)),
    difficulties: asList(params.difficulty).filter((d) => DIFFICULTY_VALUES.has(d as never)),
    taste,
    maxMinutes: Number.isNaN(parsedTime) ? null : Math.max(1, Math.min(24 * 60, parsedTime)),
    // A continuous ceiling: any sane per-serving value, clamped to the slider's
    // range. Below the floor means "no ceiling"; above it is capped.
    maxCalories:
      Number.isNaN(parsedKcal) || parsedKcal >= CALORIE_MAX
        ? null
        : Math.max(CALORIE_MIN, parsedKcal),
    minRating: parseMinRating(first(params.rating)),
    maxCost: (() => {
      const c = first(params.cost)
      const n = c ? Number.parseInt(c, 10) : Number.NaN
      return Number.isNaN(n) || n <= 0 ? null : n
    })(),
    equipment: asList(params.equip).filter((e) => EQUIPMENT_VALUES.has(e)),
    onePan: first(params.onepan) === '1',
    makeAhead: first(params.prep) === '1',
    keepsWell: first(params.keeps) === '1',
    tasteVector: parseVector(first(params.tp)),
    q: (first(params.q) ?? '').trim().slice(0, 80),
    page: Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage),
    sort: sortParam && SORT_VALUES.has(sortParam) ? (sortParam as SortKey) : 'newest',
  }
}

/** True when the visitor has narrowed anything — drives the "Clear all" affordance. */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return countActiveFilters(filters) > 0
}

export function countActiveFilters(filters: CatalogFilters): number {
  return (
    filters.cuisines.length +
    filters.courses.length +
    filters.ingredients.length +
    filters.diets.length +
    filters.difficulties.length +
    (filters.maxMinutes !== null ? 1 : 0) +
    (filters.maxCalories !== null ? 1 : 0) +
    (filters.minRating !== null ? 1 : 0) +
    (filters.maxCost !== null ? 1 : 0) +
    filters.equipment.length +
    (filters.onePan ? 1 : 0) +
    (filters.makeAhead ? 1 : 0) +
    (filters.keepsWell ? 1 : 0) +
    (filters.q ? 1 : 0) +
    Object.keys(filters.taste).length
  )
}

/** Payload sort expression. Payload uses `-field` for descending.
 *
 *  Every expression carries `-id` as a tiebreaker: without one, rows that tie
 *  on the sort field (seeded recipes sharing a publishedAt, unrated recipes all
 *  at ratingScore 0) come back in whatever order Postgres feels like — and
 *  page 2 of a paginated query can re-serve rows page 1 already showed. */
export function sortExpression(sort: SortKey): string[] {
  if (sort === 'quickest') return ['totalMinutes', '-id']
  // Ascending, so the cheapest plate leads. Recipes with no cost sort last
  // rather than first — a missing price is not a free dinner.
  if (sort === 'cheapest') return ['costPerServing', '-id']
  if (sort === 'newest') return ['-publishedAt', '-id']
  if (sort === 'top') return ['-ratingScore', '-id']
  // 'foryou' is a distance sort computed in findRecipes; fall back to newest for
  // the DB query it can't express.
  if (sort === 'foryou') return ['-publishedAt', '-id']
  // Sorting *by* an axis means "most of it first" — the interesting direction.
  return [`-${sort}`, '-id']
}

/**
 * Builds the Payload `where` clause. Only published recipes are ever returned:
 * the collection's access control enforces this for HTTP callers, but the local
 * API runs with access overridden, so public queries must say so explicitly.
 */
export function buildWhere(filters: CatalogFilters): Record<string, unknown> {
  const and: Record<string, unknown>[] = [{ status: { equals: 'published' } }]

  if (filters.q) {
    // Title alone sent real queries to a dead end: "korean" found nothing even
    // though a Korean cuisine hub with recipes sat one filter away, because no
    // recipe carries the word in its title. A search term can name the dish,
    // the cuisine, or something in it.
    and.push({
      or: [
        { title: { like: filters.q } },
        { 'cuisine.name': { like: filters.q } },
        { 'ingredients.item': { like: filters.q } },
      ],
    })
  }

  if (filters.cuisines.length > 0) {
    and.push({ 'cuisine.slug': { in: filters.cuisines } })
  }

  if (filters.courses.length > 0) {
    and.push({ course: { in: filters.courses } })
  }

  if (filters.ingredients.length > 0) {
    and.push({ mainIngredient: { in: filters.ingredients } })
  }

  // Dietary tags are additive: "vegan + gluten-free" must mean both, not either.
  for (const diet of filters.diets) {
    and.push({ dietaryTags: { contains: diet } })
  }

  if (filters.difficulties.length > 0) {
    and.push({ difficulty: { in: filters.difficulties } })
  }

  if (filters.maxMinutes !== null) {
    and.push({ totalMinutes: { less_than_equal: filters.maxMinutes } })
  }

  if (filters.maxCalories !== null) {
    and.push({ 'nutrition.calories': { less_than_equal: filters.maxCalories } })
  }

  if (filters.minRating !== null) {
    and.push({ ratingScore: { greater_than_equal: filters.minRating } })
  }

  if (filters.maxCost !== null) {
    and.push({ costPerServing: { less_than_equal: filters.maxCost } })
  }

  // Equipment is additive: selecting "one-pan-friendly + no-oven" means both.
  for (const e of filters.equipment) {
    and.push({ equipment: { contains: e } })
  }

  if (filters.onePan) and.push({ onePan: { equals: true } })
  if (filters.makeAhead) and.push({ makeAhead: { equals: true } })
  if (filters.keepsWell) and.push({ 'finish.storageDays': { greater_than_equal: 2 } })

  for (const [axis, range] of Object.entries(filters.taste)) {
    if (range.min > AXIS_MIN) and.push({ [axis]: { greater_than_equal: range.min } })
    if (range.max < AXIS_MAX) and.push({ [axis]: { less_than_equal: range.max } })
  }

  return { and }
}

/**
 * Serialises filters back into search params. The inverse of `parseFilters`,
 * used by the client filter panel and pagination so every control produces the
 * same canonical URL shape.
 */
export function toSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.q) params.set('q', filters.q)
  for (const cuisine of filters.cuisines) params.append('cuisine', cuisine)
  for (const course of filters.courses) params.append('course', course)
  for (const ingredient of filters.ingredients) params.append('ingredient', ingredient)
  for (const diet of filters.diets) params.append('diet', diet)
  for (const difficulty of filters.difficulties) params.append('difficulty', difficulty)
  if (filters.maxMinutes !== null) params.set('time', String(filters.maxMinutes))
  if (filters.maxCalories !== null) params.set('kcal', String(filters.maxCalories))
  if (filters.minRating !== null) params.set('rating', String(filters.minRating))
  if (filters.maxCost !== null) params.set('cost', String(filters.maxCost))
  for (const e of filters.equipment) params.append('equip', e)
  if (filters.onePan) params.set('onepan', '1')
  if (filters.makeAhead) params.set('prep', '1')
  if (filters.keepsWell) params.set('keeps', '1')
  if (filters.tasteVector) params.set('tp', encodeVector(filters.tasteVector))
  for (const [axis, range] of Object.entries(filters.taste)) {
    params.set(axis, encodeTasteRange(range))
  }
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))

  return params
}

export function catalogHref(filters: CatalogFilters): string {
  const qs = toSearchParams(filters).toString()
  return qs ? `/recipes?${qs}` : '/recipes'
}
