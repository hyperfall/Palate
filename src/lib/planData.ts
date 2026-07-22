import { getPayloadClient } from './queries'
import { supabaseServer } from './supabase/server'
import type { PlanIngredient, Pantry } from './mealPlan'

/**
 * Server-side reads for the /plan page: the signed-in user's meal-plan entries
 * and pantry (from Supabase), and the planned recipes' ingredients/cost (from
 * Payload). All degrade to empty when signed out or Supabase is unconfigured.
 */
export type PlanEntry = {
  id: string
  day: number
  slug: string
  title: string
  image: string | null
  position: number
}

export type PlannedRecipe = {
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
  const { data } = await supabase
    .from('meal_plan')
    .select('id,day,recipe_slug,recipe_title,recipe_image,position')
    .order('day')
    .order('position')
  return (data ?? []).map((r) => ({
    id: r.id as string,
    day: r.day as number,
    slug: r.recipe_slug as string,
    title: r.recipe_title as string,
    image: (r.recipe_image as string | null) ?? null,
    position: r.position as number,
  }))
}

/** Ticked-staple pantry items, resolved to canonical ids + names for netting exclusion. */
export async function getPantryStaples(): Promise<Pantry> {
  const empty: Pantry = { ids: new Set(), names: new Set() }
  const supabase = await userScoped()
  if (!supabase) return empty
  const { data } = await supabase
    .from('pantry')
    .select('ingredient_slug,ingredient_name')
    .eq('is_staple', true)
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

/** Resolve planned slugs → ingredients (canonical-linked), cost, servings, leftover ideas. */
export async function loadPlannedRecipes(slugs: string[]): Promise<Map<string, PlannedRecipe>> {
  const out = new Map<string, PlannedRecipe>()
  if (slugs.length === 0) return out
  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'recipes', where: { slug: { in: [...new Set(slugs)] } }, depth: 2, limit: 200 })
  for (const r of found.docs) {
    const ingredients: PlanIngredient[] = (r.ingredients ?? []).map((row) => {
      const canon = typeof row.ingredient === 'object' && row.ingredient ? row.ingredient : null
      return {
        quantity: row.quantity ?? null,
        unit: row.unit ?? null,
        item: row.item,
        canonicalId: canon ? (canon.id as number) : null,
        canonicalName: canon ? String(canon.name) : null,
      }
    })
    out.set(r.slug, {
      ingredients,
      costPerServing: r.costPerServing ?? null,
      servings: r.servings ?? 1,
      leftoverIdeas: (r.finish as { leftoverIdeas?: string | null } | null)?.leftoverIdeas ?? null,
    })
  }
  return out
}
