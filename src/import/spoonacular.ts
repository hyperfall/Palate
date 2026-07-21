import type { Course, DietaryTag, MainIngredient } from '../lib/taxonomy'

/**
 * Spoonacular → our schema. The content half of the hybrid import pipeline:
 * Spoonacular supplies everything the page needs to be cookable — real
 * step-by-step instructions, structured ingredients, times, nutrition, and
 * price per serving. Photography is resolved separately (Edamam first) by
 * the runner; `imageUrl` here is the fallback.
 *
 * Everything imported stays `provenance: api-imported`: noindex, visible
 * attribution, machine-derived taste estimates.
 */

export type SpoonacularRecipe = {
  id?: number
  title?: string
  image?: string
  servings?: number
  readyInMinutes?: number
  preparationMinutes?: number | null
  cookingMinutes?: number | null
  pricePerServing?: number | null
  sourceName?: string | null
  sourceUrl?: string | null
  creditsText?: string | null
  vegetarian?: boolean
  vegan?: boolean
  glutenFree?: boolean
  dairyFree?: boolean
  diets?: string[]
  dishTypes?: string[]
  extendedIngredients?: Array<{
    amount?: number
    unit?: string
    name?: string
    nameClean?: string | null
    meta?: string[]
  }>
  analyzedInstructions?: Array<{
    steps?: Array<{ step?: string; length?: { number?: number; unit?: string } }>
  }>
  nutrition?: { nutrients?: Array<{ name?: string; amount?: number }> }
}

export type MappedRecipe = {
  title: string
  imageUrl: string
  course: Course
  mainIngredient: MainIngredient
  spiciness: number
  sweetness: number
  richness: number
  effort: number
  dietaryTags: DietaryTag[]
  prepMinutes: number
  cookMinutes: number
  difficulty: 'easy' | 'medium' | 'hard'
  servings: number
  costPerServing?: number
  ingredients: Array<{ quantity?: string; unit?: string; item: string; note?: string }>
  steps: Array<{ text: string; timerSeconds?: number }>
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number }
  sourceAttribution: { sourceName: string; sourceUrl: string }
}

const COURSE_BY_DISH: Array<[RegExp, Course]> = [
  [/dessert/, 'dessert'],
  [/breakfast|brunch|morning meal/, 'breakfast'],
  [/side dish|salad|condiment|sauce/, 'side'],
  [/snack|appetizer|starter|fingerfood|antipast/, 'snack'],
  [/lunch/, 'lunch'],
]

/** Ordered scan over ingredient text. First hit wins. */
const INGREDIENT_SCANS: Array<[RegExp, MainIngredient]> = [
  [/\bchicken\b/, 'chicken'],
  [/\b(beef|steak|brisket|oxtail|mince)\b/, 'beef'],
  [/\b(pork|bacon|ham|chorizo|sausage|pancetta)\b/, 'pork'],
  [/\b(lamb|mutton|goat)\b/, 'lamb'],
  [/\b(fish|prawn|shrimp|salmon|tuna|cod|squid|crab|mussel|anchov|haddock|sardine)\b/, 'seafood'],
  [/\btofu|tempeh\b/, 'tofu-tempeh'],
  [/\b(chickpea|lentil|black bean|kidney bean|butter bean|cannellini|beans?)\b/, 'legumes'],
  [/\b(noodle|pasta|spaghetti|macaroni|penne|linguine|udon|soba|vermicelli|orzo)\b/, 'pasta-noodles'],
  [/\b(paneer|halloumi|feta|mozzarella|cheddar|parmesan|cheese)\b/, 'cheese-dairy'],
  [/\brice|quinoa|barley|bulgur|couscous\b/, 'rice-grains'],
  [/\beggs?\b/, 'eggs'],
]

const HEAT_RE =
  /chill?i|cayenne|sriracha|gochujang|jalape|habanero|harissa|curry paste|szechuan|sichuan|pepper flakes|hot sauce|scotch bonnet|'nduja|sambal/g
const SWEET_RE = /\b(sugar|honey|maple|condensed milk|golden syrup|jam|molasses)\b/g
const RICH_RE =
  /\b(cream|butter|ghee|coconut milk|coconut cream|cheese|lard|mascarpone|bacon|tahini|peanut butter|crème)\b/g

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function countMatches(haystack: string, re: RegExp): number {
  return (haystack.match(re) ?? []).length
}

function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100)
}

function nutrient(raw: SpoonacularRecipe, name: string): number | undefined {
  const amount = raw.nutrition?.nutrients?.find((n) => n.name === name)?.amount
  return amount && amount > 0 ? Math.round(amount) : undefined
}

export function mapRecipe(raw: SpoonacularRecipe): MappedRecipe {
  const title = raw.title?.trim() ?? ''
  const servings = Math.max(1, Math.round(raw.servings ?? 4))
  const dishTypes = (raw.dishTypes ?? []).join(' ').toLowerCase()

  const ingredients = (raw.extendedIngredients ?? [])
    .filter((i) => (i.nameClean ?? i.name)?.trim())
    .map((i) => ({
      ...(i.amount && i.amount > 0 ? { quantity: formatQuantity(i.amount) } : {}),
      ...(i.unit?.trim() ? { unit: i.unit.trim() } : {}),
      item: (i.nameClean ?? i.name)!.trim(),
      ...(i.meta?.length ? { note: i.meta.join(', ') } : {}),
    }))

  const steps = (raw.analyzedInstructions ?? [])
    .flatMap((block) => block.steps ?? [])
    .filter((s) => s.step?.trim())
    .map((s) => ({
      text: s.step!.trim(),
      ...(s.length?.number
        ? { timerSeconds: s.length.number * (s.length.unit === 'hours' ? 3600 : 60) }
        : {}),
    }))
    .slice(0, 24)

  const ingredientText = ingredients.map((i) => i.item).join(' ').toLowerCase()

  const course: Course = COURSE_BY_DISH.find(([re]) => re.test(dishTypes))?.[1] ?? 'dinner'

  const mainIngredient: MainIngredient =
    INGREDIENT_SCANS.find(([re]) => re.test(ingredientText))?.[1] ?? 'vegetables'

  const heatHits = countMatches(ingredientText, HEAT_RE)
  const spiciness =
    heatHits >= 2 ? 4 : heatHits === 1 ? 3 : /curry powder|paprika/.test(ingredientText) ? 2 : 0
  const sweetness = course === 'dessert' ? 5 : clamp(countMatches(ingredientText, SWEET_RE), 0, 2)
  const richness = clamp(countMatches(ingredientText, RICH_RE) + 1, 1, 5)

  const effort = steps.length <= 4 ? 1 : steps.length <= 7 ? 2 : steps.length <= 11 ? 3 : 4
  const difficulty = effort <= 2 ? 'easy' : effort === 3 ? 'medium' : 'hard'

  const dietaryTags: DietaryTag[] = [
    ...(raw.vegan ? (['vegan', 'vegetarian'] as const) : raw.vegetarian ? (['vegetarian'] as const) : []),
    ...(raw.glutenFree ? (['gluten-free'] as const) : []),
    ...(raw.dairyFree ? (['dairy-free'] as const) : []),
    ...(raw.diets?.some((d) => /pescatarian|pescetarian/i.test(d)) ? (['pescatarian'] as const) : []),
    ...(raw.diets?.some((d) => /ketogenic/i.test(d)) ? (['low-carb'] as const) : []),
  ]

  const ready = raw.readyInMinutes && raw.readyInMinutes > 0 ? clamp(raw.readyInMinutes, 5, 600) : 35
  const prep =
    raw.preparationMinutes && raw.preparationMinutes > 0
      ? clamp(raw.preparationMinutes, 0, ready)
      : Math.round(ready * 0.3)
  const cook =
    raw.cookingMinutes && raw.cookingMinutes > 0
      ? clamp(raw.cookingMinutes, 0, 600)
      : Math.max(ready - prep, 0)

  const nutritionGroup = {
    calories: nutrient(raw, 'Calories'),
    protein: nutrient(raw, 'Protein'),
    carbs: nutrient(raw, 'Carbohydrates'),
    fat: nutrient(raw, 'Fat'),
  }

  return {
    title,
    imageUrl: raw.image?.trim() ?? '',
    course,
    mainIngredient,
    spiciness,
    sweetness,
    richness,
    effort,
    dietaryTags,
    prepMinutes: prep,
    cookMinutes: cook,
    difficulty,
    servings,
    ...(raw.pricePerServing && raw.pricePerServing > 0
      ? { costPerServing: Math.round(raw.pricePerServing) }
      : {}),
    ingredients,
    steps,
    ...(nutritionGroup.calories ? { nutrition: nutritionGroup } : {}),
    sourceAttribution: {
      sourceName: raw.sourceName?.trim() || raw.creditsText?.trim() || 'Spoonacular',
      sourceUrl:
        raw.sourceUrl?.trim() || `https://spoonacular.com/recipes/${slugish(title)}-${raw.id ?? ''}`,
    },
  }
}

function slugish(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
