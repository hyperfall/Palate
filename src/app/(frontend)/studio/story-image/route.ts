import { NextResponse, type NextRequest } from 'next/server'

import { imageFrom } from '@/lib/media'
import { getPayloadClient } from '@/lib/queries'
import { limited } from '@/lib/rateLimit'
import { isCreator, serverUser } from '@/lib/supabase/server'

/**
 * Uploads one Story image and returns its id + URL, so the studio can insert
 * `![](url)` into the markdown at authoring time (the markdown needs the URL
 * up front). Creator-authed; raster formats only — never SVG (stored-XSS).
 */
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export async function POST(request: NextRequest) {
  const user = await serverUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!isCreator(user)) return NextResponse.json({ error: 'Creator account required.' }, { status: 403 })
  const rl = limited(request, { name: 'story-image', id: user.id, limit: 30, windowMs: 5 * 60_000 })
  if (rl) return rl

  const form = await request.formData()
  const file = form.get('image')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No image.' }, { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (15MB max).' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Image must be a JPEG, PNG, WebP, or AVIF.' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const media = await payload.create({
    collection: 'media',
    data: {
      alt: 'Story image',
      credit: user.user_metadata?.display_name ?? user.email ?? 'Creator submission',
      license: 'original',
    },
    file: {
      data: Buffer.from(await file.arrayBuffer()),
      mimetype: file.type,
      name: file.name || 'story-image.jpg',
      size: file.size,
    },
  })

  const url = imageFrom(media as never)?.url ?? (media as { url?: string }).url ?? null
  return NextResponse.json({ id: media.id, url })
}
