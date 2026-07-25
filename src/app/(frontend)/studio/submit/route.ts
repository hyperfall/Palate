import { NextResponse, type NextRequest } from 'next/server'

import { parseIngredientLine } from '@/lib/ingredients/parse'
import { plainTextToLexical } from '@/lib/lexical'
import { limited } from '@/lib/rateLimit'
import { MIN_INGREDIENTS, MIN_STEPS, validateRecipeNumbers } from '@/lib/recipeLimits'
import { getPayloadClient } from '@/lib/queries'
import { isCreator, serverUser } from '@/lib/supabase/server'

/**
 * Creator submissions. Auth is Supabase (account_type 'creator' required);
 * storage is the spec's `submissions` collection, moderated in /admin —
 * approval auto-promotes to a published recipe (see Submissions.ts hook).
 * Lives outside `/api` because Payload owns that path.
 */
export const dynamic = 'force-dynamic'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

type StepIn = { text: string; timerSeconds?: number | null }
type IngredientIn = { quantity?: string; unit?: string; item: string; note?: string }

export async function POST(request: NextRequest) {
  const user = await serverUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }
  if (!isCreator(user)) {
    return NextResponse.json({ error: 'Creator account required.' }, { status: 403 })
  }
  const rl = limited(request, { name: 'submit', id: user.id, limit: 5, windowMs: 10 * 60_000 })
  if (rl) return rl

  const form = await request.formData()
  const raw = form.get('recipe')
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'Missing recipe payload.' }, { status: 400 })
  }

  let recipe: {
    title: string
    story?: string
    storyMarkdown?: string
    storyImageIds?: number[]
    editsRecipe?: number
    keepHeroImageId?: number
    cuisine: number
    course: string
    mainIngredient: string
    servings: number
    prepMinutes: number
    cookMinutes: number
    difficulty: string
    spiciness: number
    sweetness: number
    richness: number
    effort: number
    dietaryTags?: string[]
    videoUrl?: string
    ingredients: IngredientIn[]
    steps: StepIn[]
  }
  try {
    recipe = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Malformed recipe payload.' }, { status: 400 })
  }

  if (
    !recipe.title?.trim() ||
    !recipe.cuisine ||
    !Array.isArray(recipe.ingredients) ||
    recipe.ingredients.length < MIN_INGREDIENTS ||
    !Array.isArray(recipe.steps) ||
    recipe.steps.length < MIN_STEPS
  ) {
    return NextResponse.json(
      {
        error: `A recipe needs a title, cuisine, at least ${MIN_INGREDIENTS} ingredients, and ${MIN_STEPS} steps.`,
      },
      { status: 400 },
    )
  }

  // Server-side range gate — the form clamps these, but a crafted POST bypasses
  // the form. Reject unrealistic numbers before anything touches the database.
  const numberError = validateRecipeNumbers(recipe)
  if (numberError) {
    return NextResponse.json({ error: numberError }, { status: 400 })
  }

  const payload = await getPayloadClient()

  // Editing an existing recipe → verify the creator owns it before linking.
  let editsRecipe: number | undefined
  if (Number.isInteger(recipe.editsRecipe)) {
    const target = await payload
      .findByID({ collection: 'recipes', id: recipe.editsRecipe as number, depth: 1 })
      .catch(() => null)
    const owner = target && typeof target.author === 'object' ? (target.author.creatorId ?? null) : null
    if (!target || owner !== user.id) {
      return NextResponse.json({ error: 'You can only edit your own recipes.' }, { status: 403 })
    }
    editsRecipe = recipe.editsRecipe as number
  }

  // The creator's own photograph — the whole point of the platform.
  let heroImage: number | undefined
  const photo = form.get('photo')
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo too large (15MB max).' }, { status: 400 })
    }
    // Allow-list raster formats only — never image/svg+xml (SVGs can carry
    // scripts, a stored-XSS vector once served from the media endpoint).
    if (!ALLOWED_IMAGE_TYPES.has(photo.type)) {
      return NextResponse.json(
        { error: 'Photo must be a JPEG, PNG, WebP, or AVIF.' },
        { status: 400 },
      )
    }
    const media = await payload.create({
      collection: 'media',
      data: {
        alt: recipe.title,
        credit: user.user_metadata?.display_name ?? user.email ?? 'Creator submission',
        license: 'original',
      },
      file: {
        data: Buffer.from(await photo.arrayBuffer()),
        mimetype: photo.type,
        name: photo.name || 'creator-photo.jpg',
        size: photo.size,
      },
    })
    heroImage = media.id
  }
  // Editing without a new photo: keep the recipe's current hero image.
  if (heroImage === undefined && Number.isInteger(recipe.keepHeroImageId)) {
    heroImage = recipe.keepHeroImageId
  }

  // The creator's avatar id lives in their auth metadata; if that media was since
  // deleted (e.g. a media cleanup), the stale relationship id fails the insert —
  // so only attach it when it still resolves.
  const rawAvatar = user.user_metadata?.avatar_media_id
  const avatarId =
    typeof rawAvatar === 'number'
      ? rawAvatar
      : typeof rawAvatar === 'string' && /^\d+$/.test(rawAvatar)
        ? Number(rawAvatar)
        : null
  let creatorAvatar: number | null = null
  if (avatarId !== null) {
    const avatarMedia = await payload.findByID({ collection: 'media', id: avatarId }).catch(() => null)
    if (avatarMedia) creatorAvatar = avatarId
  }

  try {
    const submission = await payload.create({
      collection: 'submissions',
      data: {
        title: recipe.title.trim(),
        ...(heroImage ? { heroImage } : {}),
        ...(recipe.story?.trim() ? { story: plainTextToLexical(recipe.story) } : {}),
        ...(recipe.storyMarkdown?.trim() ? { storyMarkdown: recipe.storyMarkdown.trim().slice(0, 5000) } : {}),
        ...(Array.isArray(recipe.storyImageIds) && recipe.storyImageIds.length
          ? { storyImages: recipe.storyImageIds.filter((n) => Number.isInteger(n)) }
          : {}),
        servings: recipe.servings,
        // Pasted lines arrive whole in `item`; split quantity/unit out so the
        // recipe stores them structured (editor can correct before approval).
        ingredients: recipe.ingredients.map((ing) => {
          const parsed = parseIngredientLine(ing.item ?? '')
          return {
            quantity: ing.quantity ?? parsed.quantity,
            unit: ing.unit ?? parsed.unit,
            item: parsed.item || ing.item,
            ...(ing.note ? { note: ing.note } : {}),
          }
        }),
        steps: recipe.steps,
        cuisine: recipe.cuisine,
        course: recipe.course,
        mainIngredient: recipe.mainIngredient,
        spiciness: recipe.spiciness,
        sweetness: recipe.sweetness,
        richness: recipe.richness,
        effort: recipe.effort,
        dietaryTags: recipe.dietaryTags,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        difficulty: recipe.difficulty,
        ...(editsRecipe ? { editsRecipe } : {}),
        moderationStatus: 'pending',
        creatorId: user.id,
        creatorName: user.user_metadata?.display_name ?? null,
        creatorEmail: user.email ?? null,
        creatorHandle: user.user_metadata?.username ?? null,
        creatorAvatar,
        videoUrl: recipe.videoUrl || null,
      } as never,
    })
    return NextResponse.json({ ok: true, id: submission.id })
  } catch (error) {
    // Schema/insert validation reads as a client error, not a server fault — but
    // log the real cause server-side, since it's masked from the client on purpose.
    console.error('[studio/submit] submission create failed:', error)
    return NextResponse.json(
      { error: 'Some fields didn’t pass validation — check cuisine, meal, and taste values.' },
      { status: 400 },
    )
  }
}
