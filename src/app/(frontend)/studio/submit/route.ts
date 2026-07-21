import { NextResponse, type NextRequest } from 'next/server'

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

  const form = await request.formData()
  const raw = form.get('recipe')
  if (typeof raw !== 'string') {
    return NextResponse.json({ error: 'Missing recipe payload.' }, { status: 400 })
  }

  let recipe: {
    title: string
    story?: string
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
    !recipe.ingredients?.length ||
    !recipe.steps?.length
  ) {
    return NextResponse.json(
      { error: 'A recipe needs a title, cuisine, ingredients, and steps.' },
      { status: 400 },
    )
  }

  const payload = await getPayloadClient()

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

  try {
    const submission = await payload.create({
      collection: 'submissions',
      data: {
        title: recipe.title.trim(),
        ...(heroImage ? { heroImage } : {}),
        servings: recipe.servings,
        ingredients: recipe.ingredients,
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
        moderationStatus: 'pending',
        creatorId: user.id,
        creatorName: user.user_metadata?.display_name ?? null,
        creatorEmail: user.email ?? null,
        creatorHandle: user.user_metadata?.username ?? null,
        creatorAvatar: user.user_metadata?.avatar_media_id ?? null,
        videoUrl: recipe.videoUrl || null,
      } as never,
    })
    return NextResponse.json({ ok: true, id: submission.id })
  } catch {
    // Schema validation (bad cuisine id, out-of-range taste axis, unknown
    // course/diet) reads as a client error, not a server fault.
    return NextResponse.json(
      { error: 'Some fields didn’t pass validation — check cuisine, meal, and taste values.' },
      { status: 400 },
    )
  }
}
