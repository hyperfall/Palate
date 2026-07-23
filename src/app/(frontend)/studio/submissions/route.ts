import { NextResponse } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { serverUser } from '@/lib/supabase/server'

/**
 * A creator's own submissions, so they can track what they've sent and where it
 * stands. Server-authed: the creatorId filter comes from the signed-in Supabase
 * user, never from the client, so a creator can only ever see their own. Reads
 * via the local API (submissions are otherwise admin-only).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await serverUser()
  if (!user) return NextResponse.json({ submissions: [] })

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'submissions',
    where: { creatorId: { equals: user.id } },
    sort: '-createdAt',
    depth: 1,
    limit: 100,
  })

  const submissions = result.docs.map((doc) => {
    const promoted = doc.promotedRecipe
    return {
      id: doc.id,
      title: doc.title,
      status: doc.moderationStatus ?? 'pending',
      createdAt: doc.createdAt,
      recipeSlug:
        promoted && typeof promoted === 'object' ? ((promoted as { slug?: string }).slug ?? null) : null,
    }
  })

  return NextResponse.json({ submissions })
}
