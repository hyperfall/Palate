import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { cleanSocials, SOCIAL_KEYS, type Socials } from '@/lib/socials'
import { isCreator, serverUser } from '@/lib/supabase/server'

/** Self-service social links for creators — updates their own author profile. */
export const dynamic = 'force-dynamic'

const emptySocials = (): Socials => Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ''])) as Socials

/** Current socials for the signed-in creator (drives the account editor). */
export async function GET() {
  const user = await serverUser()
  if (!user || !isCreator(user)) return NextResponse.json({ creator: false, hasProfile: false, socials: emptySocials() })
  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'authors', where: { creatorId: { equals: user.id } }, limit: 1 })
  const author = found.docs[0]
  return NextResponse.json({
    creator: true,
    hasProfile: Boolean(author),
    socials: { ...emptySocials(), ...cleanSocials((author?.socials as Record<string, unknown>) ?? null) },
  })
}

export async function POST(request: NextRequest) {
  const user = await serverUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!isCreator(user)) return NextResponse.json({ error: 'Creator account required.' }, { status: 403 })

  let body: { socials?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  // Validate + normalise; a bad non-empty link is rejected rather than silently dropped.
  const raw = (body.socials ?? {}) as Record<string, unknown>
  const cleaned = cleanSocials(raw)
  for (const key of SOCIAL_KEYS) {
    const entered = typeof raw[key] === 'string' ? (raw[key] as string).trim() : ''
    if (entered && !cleaned[key]) {
      return NextResponse.json({ error: `That ${key} link doesn’t look like a valid URL.` }, { status: 400 })
    }
  }
  // Store empty strings for cleared fields so the group overwrites cleanly.
  const socials = { ...emptySocials(), ...cleaned }

  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'authors', where: { creatorId: { equals: user.id } }, limit: 1 })
  const author = found.docs[0]
  if (!author) {
    return NextResponse.json(
      { error: 'No creator profile yet. Publish a recipe first, then add your links.' },
      { status: 404 },
    )
  }

  await payload.update({ collection: 'authors', id: author.id, data: { socials } })
  return NextResponse.json({ ok: true, socials })
}
