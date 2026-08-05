import { NextResponse, type NextRequest } from 'next/server'
import type { Where } from 'payload'

import { getPayloadClient } from '@/lib/queries'
import { serverUser } from '@/lib/supabase/server'

/**
 * A creator's own submissions — paginated, searchable, status-filterable so the
 * portfolio scales past a handful of recipes. Server-authed: the creatorId
 * filter comes from the signed-in Supabase user, never the client, so a creator
 * can only ever see their own. Reads via the local API (submissions are
 * otherwise admin-only).
 */
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
const STATUSES = new Set(['pending', 'approved', 'rejected'])

export async function GET(request: NextRequest) {
  const user = await serverUser()
  if (!user) return NextResponse.json({ submissions: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 })

  const params = request.nextUrl.searchParams
  const page = Math.max(1, Number(params.get('page')) || 1)
  const q = params.get('q')?.trim()
  const status = params.get('status')?.trim()

  const where: Where = { creatorId: { equals: user.id } }
  if (q) where.title = { like: q }
  if (status && STATUSES.has(status)) where.moderationStatus = { equals: status }

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'submissions',
    where,
    sort: '-createdAt',
    depth: 1,
    page,
    limit: PAGE_SIZE,
  })

  const submissions = result.docs.map((doc) => {
    const promoted = doc.promotedRecipe
    const promotedObj = promoted && typeof promoted === 'object' ? (promoted as { id?: number; slug?: string }) : null
    return {
      id: doc.id,
      title: doc.title,
      status: doc.moderationStatus ?? 'pending',
      createdAt: doc.createdAt,
      recipeSlug: promotedObj?.slug ?? null,
      recipeId: promotedObj?.id ?? (typeof promoted === 'number' ? promoted : null),
      // A revision of a recipe that is already live, not a new one. Without
      // this the creator's own list shows the same dish twice, both marked
      // published, and reads as an accidental duplicate.
      isEdit: Boolean(doc.editsRecipe),
    }
  })

  return NextResponse.json({
    submissions,
    total: result.totalDocs,
    page: result.page ?? page,
    pageSize: PAGE_SIZE,
    totalPages: result.totalPages ?? 1,
  })
}
