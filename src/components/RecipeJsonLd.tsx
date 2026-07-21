import type { Recipe } from '@/payload-types'
import { absoluteUrl } from '@/lib/site'
import { formatIngredient, toIsoDuration } from '@/lib/format'
import { imageFrom } from '@/lib/media'
import { lexicalToPlainText } from '@/lib/lexical'

/**
 * Recipe structured data — design spec §8.
 *
 * "This is what earns the rich cards with star ratings + photo carousel at the
 * top of Google — invisible to users, fully legit." Note what is NOT here:
 * no aggregateRating, because we have no ratings. Inventing them is precisely
 * the structured-data spam that earns a manual action, and §8 rules out
 * anything in that family.
 */
export function RecipeJsonLd({ recipe }: { recipe: Recipe }) {
  const hero = imageFrom(recipe.heroImage, 'hero')
  const author = typeof recipe.author === 'object' ? recipe.author : null
  const cuisine = typeof recipe.cuisine === 'object' ? recipe.cuisine : null

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
    ...(recipe.story ? { description: lexicalToPlainText(recipe.story as never) } : {}),
    ...(cuisine ? { recipeCuisine: cuisine.name } : {}),
    recipeYield: `${recipe.servings} servings`,
    ...(toIsoDuration(recipe.prepMinutes) ? { prepTime: toIsoDuration(recipe.prepMinutes) } : {}),
    ...(toIsoDuration(recipe.cookMinutes) ? { cookTime: toIsoDuration(recipe.cookMinutes) } : {}),
    ...(toIsoDuration(recipe.totalMinutes) ? { totalTime: toIsoDuration(recipe.totalMinutes) } : {}),
    ...(recipe.dietaryTags?.length ? { keywords: recipe.dietaryTags.join(', ') } : {}),
    recipeIngredient: (recipe.ingredients ?? []).map(formatIngredient),
    recipeInstructions: (recipe.steps ?? []).map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text: step.text,
    })),
    ...(hasNutrition
      ? {
          nutrition: {
            '@type': 'NutritionInformation',
            ...(nutrition?.calories ? { calories: `${nutrition.calories} calories` } : {}),
            ...(nutrition?.protein ? { proteinContent: `${nutrition.protein} g` } : {}),
            ...(nutrition?.carbs ? { carbohydrateContent: `${nutrition.carbs} g` } : {}),
            ...(nutrition?.fat ? { fatContent: `${nutrition.fat} g` } : {}),
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
