import type { Recipe } from '@/payload-types'
import { absoluteUrl } from '@/lib/site'
import { formatIngredient, toIsoDuration } from '@/lib/format'
import { imageFrom } from '@/lib/media'
import { lexicalToPlainText } from '@/lib/lexical'

/**
 * Recipe structured data — design spec §8.
 *
 * "This is what earns the rich cards with star ratings + photo carousel at the
 * top of Google — invisible to users, fully legit." aggregateRating is emitted
 * ONLY from real community votes (never the editorial override, never a seeded
 * value) — inventing ratings is the structured-data spam that earns a manual
 * action, and §8 rules out anything in that family.
 */
export function RecipeJsonLd({ recipe }: { recipe: Recipe }) {
  const hero = imageFrom(recipe.heroImage, 'hero')
  const author = typeof recipe.author === 'object' ? recipe.author : null
  const cuisine = typeof recipe.cuisine === 'object' ? recipe.cuisine : null

  const ratingCount = recipe.ratingCount ?? 0
  const ratingValue =
    ratingCount > 0 ? Math.round(((recipe.ratingSum ?? 0) / ratingCount) * 100) / 100 : 0

  // Google wants a description on every recipe, but only 15 of 18 here carry a
  // story — a storyless recipe was shipping none at all. Fall back to a factual
  // line built from the recipe's own data rather than leaving the field empty.
  const storyText = recipe.story ? lexicalToPlainText(recipe.story as never).trim() : ''
  const dish = cuisine ? `${cuisine.name} ${recipe.course}` : String(recipe.course)
  const timing = recipe.totalMinutes ? `, ready in ${recipe.totalMinutes} minutes` : ''
  // Same chain the page's generateMetadata uses, so the schema and the meta tag
  // never disagree: the curated description first, then the story, then a line
  // built from the recipe's own facts.
  const description =
    recipe.metaDescription?.trim() ||
    storyText ||
    `${recipe.title}: a ${dish} for ${recipe.servings}${timing}.`

  const nutrition = recipe.nutrition
  const hasNutrition =
    nutrition &&
    (nutrition.calories || nutrition.protein || nutrition.carbs || nutrition.fat)

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    url: absoluteUrl(`/recipes/${recipe.slug}`),
    ...(hero ? { image: [absoluteUrl(hero.url)] } : {}),
    ...(author ? { author: { '@type': 'Person', name: author.name } } : {}),
    ...(recipe.publishedAt ? { datePublished: recipe.publishedAt } : {}),
    description,
    ...(cuisine ? { recipeCuisine: cuisine.name } : {}),
    // Course is set on every recipe and maps straight onto Google's
    // recipeCategory — it was simply never emitted.
    ...(recipe.course ? { recipeCategory: recipe.course } : {}),
    ...(recipe.updatedAt ? { dateModified: recipe.updatedAt } : {}),
    ...(ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue,
            ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    recipeYield: `${recipe.servings} servings`,
    ...(toIsoDuration(recipe.prepMinutes) ? { prepTime: toIsoDuration(recipe.prepMinutes) } : {}),
    ...(toIsoDuration(recipe.cookMinutes) ? { cookTime: toIsoDuration(recipe.cookMinutes) } : {}),
    ...(toIsoDuration(recipe.totalMinutes) ? { totalTime: toIsoDuration(recipe.totalMinutes) } : {}),
    ...(recipe.dietaryTags?.length ? { keywords: recipe.dietaryTags.join(', ') } : {}),
    recipeIngredient: (recipe.ingredients ?? []).map(formatIngredient),
    recipeInstructions: (recipe.steps ?? []).map((step, index) => {
      // A step photo is what puts thumbnails in Google's instruction carousel.
      const shot = imageFrom(step.image, 'card')
      return {
        '@type': 'HowToStep',
        position: index + 1,
        text: step.text,
        ...(shot ? { image: absoluteUrl(shot.url) } : {}),
      }
    }),
    ...(hasNutrition
      ? {
          nutrition: {
            '@type': 'NutritionInformation',
            ...(nutrition?.calories ? { calories: `${nutrition.calories} calories` } : {}),
            ...(nutrition?.protein ? { proteinContent: `${nutrition.protein} g` } : {}),
            ...(nutrition?.carbs ? { carbohydrateContent: `${nutrition.carbs} g` } : {}),
            ...(nutrition?.fat ? { fatContent: `${nutrition.fat} g` } : {}),
            ...(nutrition?.saturates != null ? { saturatedFatContent: `${nutrition.saturates} g` } : {}),
            ...(nutrition?.sugars != null ? { sugarContent: `${nutrition.sugars} g` } : {}),
            ...(nutrition?.fibre != null ? { fiberContent: `${nutrition.fibre} g` } : {}),
            // schema.org speaks sodium, UK labels speak salt: sodium = salt ÷ 2.5.
            ...(nutrition?.salt != null
              ? { sodiumContent: `${Math.round((nutrition.salt / 2.5) * 1000)} mg` }
              : {}),
            ...(nutrition?.servingGrams ? { servingSize: `${nutrition.servingGrams} g` } : {}),
          },
        }
      : {}),
  }

  return (
    <script
      type="application/ld+json"
      // Payload content is editor-authored, but JSON.stringify still needs its
      // closing-tag escape so a "</script>" in a field cannot break out.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      }}
    />
  )
}
