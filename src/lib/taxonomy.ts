/**
 * Shared vocabulary for the recipe catalog.
 *
 * Taste axes are stored as integers 0–5 (machine-filterable, stable across copy
 * changes) but are *displayed* as words. Design spec §11 Q3 asked "numbers vs.
 * labels" — the answer is both: integers in the DB, labels in the UI. Filters
 * stay cheap, and a cook never has to decode what "richness: 4" means.
 */

export const TASTE_AXES = ['spiciness', 'sweetness', 'richness', 'effort'] as const
export type TasteAxis = (typeof TASTE_AXES)[number]

export const TASTE_AXIS_LABELS: Record<TasteAxis, { title: string; scale: string[] }> = {
  spiciness: {
    title: 'Heat',
    scale: ['No heat', 'Barely there', 'Mild', 'Warm', 'Hot', 'Fiery'],
  },
  sweetness: {
    title: 'Sweetness',
    scale: ['Savoury', 'Barely sweet', 'Lightly sweet', 'Sweet', 'Very sweet', 'Dessert-sweet'],
  },
  richness: {
    title: 'Richness',
    scale: ['Clean', 'Light', 'Balanced', 'Rich', 'Very rich', 'Decadent'],
  },
  effort: {
    title: 'Effort',
    scale: ['Effortless', 'Easy', 'Some prep', 'Involved', 'Ambitious', 'A project'],
  },
}

/** Turn a stored 0–5 integer into the word a cook actually reads. */
export function tasteLabel(axis: TasteAxis, value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const scale = TASTE_AXIS_LABELS[axis].scale
  return scale[Math.max(0, Math.min(scale.length - 1, Math.round(value)))] ?? null
}

/**
 * The practical facets. The taste axes are the signature, but a filter earns
 * trust by answering the ordinary questions first: what meal, built on what,
 * how heavy. Taste is a feature of the catalog, not the whole catalog.
 */
export const COURSES = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Side', value: 'side' },
  { label: 'Snack', value: 'snack' },
  { label: 'Dessert', value: 'dessert' },
] as const

export type Course = (typeof COURSES)[number]['value']

export const MAIN_INGREDIENTS = [
  { label: 'Chicken', value: 'chicken' },
  { label: 'Beef', value: 'beef' },
  { label: 'Pork', value: 'pork' },
  { label: 'Lamb', value: 'lamb' },
  { label: 'Seafood', value: 'seafood' },
  { label: 'Eggs', value: 'eggs' },
  { label: 'Tofu & tempeh', value: 'tofu-tempeh' },
  { label: 'Legumes', value: 'legumes' },
  { label: 'Vegetables', value: 'vegetables' },
  { label: 'Rice & grains', value: 'rice-grains' },
  { label: 'Pasta & noodles', value: 'pasta-noodles' },
  { label: 'Cheese & dairy', value: 'cheese-dairy' },
  { label: 'Duck', value: 'duck' },
  { label: 'Turkey', value: 'turkey' },
  { label: 'Mushrooms', value: 'mushrooms' },
  { label: 'Potatoes', value: 'potatoes' },
  { label: 'Bread & dough', value: 'bread-dough' },
  { label: 'Chocolate & sweets', value: 'chocolate-sweets' },
  { label: 'Fruit', value: 'fruit' },
  { label: 'Squash & pumpkin', value: 'squash-pumpkin' },
  { label: 'Corn & maize', value: 'corn-maize' },
  { label: 'Plantains & cassava', value: 'plantains-cassava' },
] as const

export type MainIngredient = (typeof MAIN_INGREDIENTS)[number]['value']

export const DIETARY_TAGS = [
  { label: 'Vegan', value: 'vegan' },
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Pescatarian', value: 'pescatarian' },
  { label: 'Gluten-free', value: 'gluten-free' },
  { label: 'Dairy-free', value: 'dairy-free' },
  { label: 'Nut-free', value: 'nut-free' },
  { label: 'Egg-free', value: 'egg-free' },
  { label: 'Low-carb', value: 'low-carb' },
  { label: 'Keto', value: 'keto' },
  { label: 'Paleo', value: 'paleo' },
  { label: 'Whole30', value: 'whole30' },
  { label: 'Halal', value: 'halal' },
  { label: 'Kosher', value: 'kosher' },
  { label: 'Low-FODMAP', value: 'low-fodmap' },
  { label: 'Sugar-free', value: 'sugar-free' },
  { label: 'High-protein', value: 'high-protein' },
  { label: 'Low-sodium', value: 'low-sodium' },
  { label: 'Soy-free', value: 'soy-free' },
  { label: 'Shellfish-free', value: 'shellfish-free' },
] as const

export type DietaryTag = (typeof DIETARY_TAGS)[number]['value']

/**
 * The dietary tags that are allergen *free-of* claims, re-framed for an
 * "Avoiding…" filter. The stored value is unchanged (`nut-free`); only the
 * presentation flips to the allergen noun ("Nuts"). Selecting one shows recipes
 * explicitly TAGGED free of that allergen — it never infers that an untagged
 * recipe is safe, which is the only correct direction for a safety filter.
 */
export const ALLERGENS = [
  { label: 'Gluten', tag: 'gluten-free' },
  { label: 'Dairy', tag: 'dairy-free' },
  { label: 'Nuts', tag: 'nut-free' },
  { label: 'Egg', tag: 'egg-free' },
  { label: 'Soy', tag: 'soy-free' },
  { label: 'Shellfish', tag: 'shellfish-free' },
] as const

export const ALLERGEN_TAGS = new Set<string>(ALLERGENS.map((a) => a.tag))

/** Dietary tags minus the allergen claims — those live in the "Avoiding" group. */
export const LIFESTYLE_DIETS = DIETARY_TAGS.filter((t) => !ALLERGEN_TAGS.has(t.value))

export const DIFFICULTIES = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
] as const

/**
 * §3: `provenance` is load-bearing — it drives trust badges, filtering, and
 * Google transparency. Every recipe carries it from commit one.
 */
export const PROVENANCE = [
  { label: 'Authored (human-verified)', value: 'authored' },
  { label: 'Community submission', value: 'community' },
  { label: 'API imported', value: 'api-imported' },
] as const

export type Provenance = (typeof PROVENANCE)[number]['value']

export const PROVENANCE_BADGES: Record<Provenance, { label: string; blurb: string }> = {
  authored: {
    label: 'Kitchen-tested',
    blurb: 'Written and verified by a human cook before publishing.',
  },
  community: {
    label: 'From the community',
    blurb: 'Submitted by a reader and reviewed by our editors.',
  },
  'api-imported': {
    label: 'Imported',
    blurb: 'Sourced from a partner catalogue. Original attribution preserved.',
  },
}

/** Total-time buckets used by the catalog facets. Minutes, inclusive upper bound. */
export const TIME_BUCKETS = [
  { label: 'Under 15 min', value: '0-15', max: 15 },
  { label: 'Under 30 min', value: '0-30', max: 30 },
  { label: 'Under 1 hour', value: '0-60', max: 60 },
  { label: 'Any length', value: 'any', max: Number.POSITIVE_INFINITY },
] as const
