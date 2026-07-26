import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { limited } from '@/lib/rateLimit'
import { serverUser } from '@/lib/supabase/server'

/**
 * Account avatar upload: file → Payload media, returning {id, url} for the
 * client to store in Supabase user metadata. One pipeline for all imagery.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await serverUser()
  // Uploads are storage-cost abuse without a ceiling.
  const rl = limited(request, { name: 'avatar', id: user?.id, limit: 10, windowMs: 10 * 60_000 })
  if (rl) return rl
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('avatar')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Avatar too large (5MB max).' }, { status: 400 })
  }
  // Raster only — image/svg+xml can carry scripts (stored-XSS once served).
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
    return NextResponse.json(
      { error: 'Avatar must be a JPEG, PNG, WebP, or AVIF.' },
      { status: 400 },
    )
  }

  const payload = await getPayloadClient()
  const media = await payload.create({
    collection: 'media',
    data: {
      alt: `${user.user_metadata?.display_name ?? 'Creator'} — avatar`,
      credit: user.email ?? 'account avatar',
      license: 'original',
    },
    file: {
      data: Buffer.from(await file.arrayBuffer()),
      mimetype: file.type,
      name: file.name || 'avatar.jpg',
      size: file.size,
    },
  })

  const url = media.sizes?.thumbnail?.url ?? media.url
  return NextResponse.json({ id: media.id, url })
}
