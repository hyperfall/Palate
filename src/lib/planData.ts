import { getActiveHouseholdId } from './household'
import { getPayloadClient } from './queries'
import { supabaseServer } from './supabase/server'
import type { PlanIngredient, Pantry } from './mealPlan'

/**
 * Scope a meal_plan/pantry query to the active context. When in a household,
 * filter to that household's shared rows. When NOT in one, apply no filter —
 * RLS already limits a non-member to their own rows, so filtering is redundant,
 * and (importantly) it keeps this path from touching the `household_id` column,
 * which only exists once the household schema block has been run. That makes the
 * personal plan work whether or not that migration has happened yet.
 */
function scopeToContext<T>(query: T, householdId: string | null): T {
  if (!householdId) return query
  const q = query as { eq: (c: string, v: string) => T }
  return q.eq('household_id', householdId)
}

/**
 * Server-side reads for the /plan page: the signed-in user's meal-plan entries
 * and pantry (from Supabase), and the planned recipes' ingredients/cost (from
 * Payload). All degrade to empty when signed out or Supabase is unconfigured.
 */
export type PlanEntry = {
  id: string
  day: number
  meal: string
  slug: string
  title: string
  image: string | null
  position: number
  /** Planned servings; null means "use the recipe's own default". */
  servings: number | null
}

export type PlannedRecipe = {
  title: string
  ingredients: PlanIngredient[]
  costPerServing: number | null
  servings: number
  leftoverIdeas: string | null
}

async function userScoped() {
  const supabase = await supabaseServer()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  return data.user ? supabase : null
}

export async function getPlanEntries(): Promise<PlanEntry[]> {
  const supabase = await userScoped()
  if (!supabase) return []
  const householdId = await getActiveHouseholdId()

  const base = 'id,day,meal,recipe_slug,recipe_title,recipe_image,position'
  const run = (cols: string) =>
    scopeToContext(supabase.from('meal_plan').select(cols), householdId).order('day').order('position')

  // Prefer the servings column; if the migration hasn't run yet the select errors,
  // so fall back to the base columns rather than blanking the whole board.
  let res = await run(`${base},servings`)
  if (res.error) res = await run(base)

  return ((res.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    day: r.day as number,
    meal: (r.meal as string | null) ?? 'dinner',
    slug: r.recipe_slug as string,
    title: r.recipe_title as string,
    image: (r.recipe_image as string | null) ?? null,
    position: r.position as number,
    servings: (r.servings as number | null) ?? null,
  }))
}

/** Ticked-staple pantry items, resolved to canonical ids + names for netting exclusion. */
export async function getPantryStaples(): Promise<Pantry> {
  const empty: Pantry = { ids: new Set(), names: new Set() }
  const supabase = await userScoped()
  if (!supabase) return empty
  const householdId = await getActiveHouseholdId()
  const { data } = await scopeToContext(
    supabase.from('pantry').select('ingredient_slug,ingredient_name'),
    householdId,
  ).eq('is_staple', true)
  const rows = data ?? []
  const names = new Set(rows.map((r) => String(r.ingredient_name).toLowerCase()))
  const ids = new Set<number>()
  const slugs = rows.map((r) => r.ingredient_slug as string).filter(Boolean)
  if (slugs.length) {
    const payload = await getPayloadClient()
    const found = await payload.find({ collection: 'ingredients', where: { slug: { in: slugs } }, depth: 0, limit: 300 })
    for (const d of found.docs) ids.add(d.id as number)
  }
  return { ids, names }
}

/** The user's full pantry, each row resolved to its canonical ingredient id (null if unmatched). */
export async function getUserPantry(): Promise<Array<{ id: number | null; slug: string; name: string }>> {
  const supabase = await userScoped()
  if (!supabase) return []
  const householdId = await getActiveHouseholdId()
  const { data } = await scopeToContext(
    supabase.from('pantry').select('ingredient_slug,ingredient_name'),
    householdId,
  ).order('created_at')
  const rows = data ?? []
  if (rows.length === 0) return []
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'ingredients',
    where: { slug: { in: rows.map((r) => r.ingredient_slug as string) } },
    depth: 0,
    limit: 300,
  })
  const bySlug = new Map(found.docs.map((d) => [String(d.slug), d.id as number]))
  return rows.map((r) => ({
    id: bySlug.get(r.ingredient_slug as string) ?? null,
    slug: r.ingredient_slug as string,
    name: r.ingredient_name as string,
  }))
}

/** Resolve planned slugs → ingredients (canonical-linked), cost, servings, leftover ideas. */
export async function loadPlannedRecipes(slugs: string[]): Promise<Map<string, PlannedRecipe>> {
  const out = new Map<string, PlannedRecipe>()
  if (slugs.length === 0) return out
  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'recipes', where: { slug: { in: [...new Set(slugs)] } }, depth: 2, limit: 200 })
  for (const r of found.docs) {
    // Drop section labels — otherwise the netted buy-list tells you to shop for
    // "To serve".
    const ingredients: PlanIngredient[] = (r.ingredients ?? []).filter((row) => !row.heading).map((row) => {
      const canon = typeof row.ingredient === 'object' && row.ingredient ? row.ingredient : null
      return {
        quantity: row.quantity ?? null,
        unit: row.unit ?? null,
        item: row.item,
        canonicalId: canon ? (canon.id as number) : null,
        canonicalName: canon ? String(canon.name) : null,
        canonicalSlug: canon && typeof canon.slug === 'string' ? canon.slug : null,
      }
    })
    out.set(r.slug, {
      title: r.title,
      ingredients,
      costPerServing: r.costPerServing ?? null,
      servings: r.servings ?? 1,
      leftoverIdeas: (r.finish as { leftoverIdeas?: string | null } | null)?.leftoverIdeas ?? null,
    })
  }
  return out
}
