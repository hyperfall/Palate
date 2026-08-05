import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { isCreator, serverUser } from '@/lib/supabase/server'

/** Self-service bio for creators — updates their own author profile (max 160 chars). */
export const dynamic = 'force-dynamic'

const MAX = 160

/** Current bio for the signed-in creator (drives the account editor). */
export async function GET() {
  const user = await serverUser()
  if (!user || !isCreator(user)) return NextResponse.json({ creator: false, bio: '', hasProfile: false })
  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'authors', where: { creatorId: { equals: user.id } }, limit: 1 })
  return NextResponse.json({
    creator: true,
    hasProfile: Boolean(found.docs[0]),
    bio: (found.docs[0]?.bio as string | undefined) ?? '',
  })
}

export async function POST(request: NextRequest) {
  const user = await serverUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!isCreator(user)) return NextResponse.json({ error: 'Creator account required.' }, { status: 403 })

  let body: { bio?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }
  const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, MAX) : ''

  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'authors',
    where: { creatorId: { equals: user.id } },
    limit: 1,
  })
  const author = found.docs[0]
  if (!author) {
    return NextResponse.json(
      { error: 'No creator profile yet. Publish a recipe first, then add your bio.' },
      { status: 404 },
    )
  }

  await payload.update({ collection: 'authors', id: author.id, data: { bio } })
  return NextResponse.json({ ok: true, bio })
}
