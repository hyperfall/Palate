import { NextResponse, type NextRequest } from 'next/server'

import { lexicalToPlainText } from '@/lib/lexical'
import { imageFrom } from '@/lib/media'
import { getPayloadClient } from '@/lib/queries'
import { isCreator, serverUser } from '@/lib/supabase/server'

/**
 * Pre-fill payload for editing an existing recipe in the studio. Owner-authed:
 * the recipe's author must map to the signed-in creator (author.creatorId ===
 * the Supabase user id), so a creator can only load their own recipes. Returns
 * the recipe in the shape the studio form uses.
 */
export const dynamic = 'force-dynamic'

const relId = (v: unknown): number | null =>
  typeof v === 'object' && v ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null

export async function GET(request: NextRequest) {
  const user = await serverUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!isCreator(user)) return NextResponse.json({ error: 'Creator account required.' }, { status: 403 })

  const id = Number(request.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 })

  const payload = await getPayloadClient()
  const recipe = await payload.findByID({ collection: 'recipes', id, depth: 1 }).catch(() => null)
  if (!recipe) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  // Ownership: the recipe's author must be this creator.
  const author = typeof recipe.author === 'object' ? recipe.author : null
  if (!author || (author.creatorId ?? null) !== user.id) {
    return NextResponse.json({ error: 'Not your recipe.' }, { status: 403 })
  }

  const hero = imageFrom(recipe.heroImage)
  return NextResponse.json({
    id: recipe.id,
    title: recipe.title ?? '',
    story: recipe.story ? lexicalToPlainText(recipe.story as never) : '',
    storyMarkdown: (recipe.storyMarkdown as string | null) ?? '',
    storyImageIds: Array.isArray(recipe.storyImages)
      ? (recipe.storyImages as unknown[]).map(relId).filter((n): n is number => n !== null)
      : [],
    cuisine: relId(recipe.cuisine),
    course: recipe.course ?? 'dinner',
    mainIngredient: recipe.mainIngredient ?? 'vegetables',
    difficulty: recipe.difficulty ?? 'easy',
    servings: recipe.servings ?? 2,
    prepMinutes: recipe.prepMinutes ?? 0,
    cookMinutes: recipe.cookMinutes ?? 0,
    spiciness: recipe.spiciness ?? 0,
    sweetness: recipe.sweetness ?? 0,
    richness: recipe.richness ?? 0,
    effort: recipe.effort ?? 0,
    dietaryTags: recipe.dietaryTags ?? [],
    videoUrl: recipe.videoUrl ?? '',
    ingredients: (recipe.ingredients ?? []).map((i) => ({
      quantity: (i.quantity as string | null) ?? '',
      unit: (i.unit as string | null) ?? '',
      item: i.item ?? '',
    })),
    steps: (recipe.steps ?? []).map((s) => ({
      text: s.text ?? '',
      imageId: relId(s.image),
      imageUrl: imageFrom(s.image, 'card')?.url ?? null,
    })),
    heroImageId: relId(recipe.heroImage),
    heroImageUrl: hero?.url ?? null,
  })
}
