import { NextResponse, type NextRequest } from 'next/server'

import { getPayloadClient } from '@/lib/queries'
import { normalizeRegions, validatePartnerRequest, type PartnerRequestInput } from '@/lib/partners'
import { limited } from '@/lib/rateLimit'

/**
 * Public advertising-request intake. Anyone may apply, but nothing is trusted:
 * the payload is validated, and the row is created via the local API (server
 * side) so `partnerRequests` can keep public create access OFF. Every request
 * lands as `status: pending` for an admin to triage in /admin.
 *
 * Outside `/api` because Payload owns that path.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rl = limited(request, { name: 'partners', limit: 3, windowMs: 10 * 60_000 })
  if (rl) return rl

  let body: Partial<PartnerRequestInput>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const error = validatePartnerRequest(body)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const payload = await getPayloadClient()
  try {
    await payload.create({
      collection: 'partnerRequests',
      data: {
        company: body.company!.trim(),
        website: body.website!.trim(),
        contactName: body.contactName!.trim(),
        contactEmail: body.contactEmail!.trim(),
        promoting: body.promoting!.trim(),
        targetRegions: normalizeRegions(body.targetRegions).map((code) => ({ code })),
        ...(body.budgetRange ? { budgetRange: body.budgetRange } : {}),
        ...(body.message?.trim() ? { message: body.message.trim() } : {}),
        status: 'pending',
      } as never,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[partners/apply] create failed:', err)
    return NextResponse.json({ error: 'Could not send your request. Try again.' }, { status: 400 })
  }
}
