import { NextResponse, type NextRequest } from 'next/server'

import { getEntitlements } from '@/lib/entitlements'
import { generateInviteCode, getActiveHouseholdId } from '@/lib/household'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { serverUser } from '@/lib/supabase/server'

/**
 * Create a household (supporter perk). Verifies the entitlement server-side,
 * then writes the household + owner membership via the service role (regular
 * users have no insert policy on those tables). One household per user.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await serverUser()
  if (!user) return NextResponse.redirect(new URL('/account', request.url))

  const entitlements = await getEntitlements()
  if (!entitlements.has('supporter')) {
    return NextResponse.redirect(new URL('/support', request.url))
  }

  if (await getActiveHouseholdId()) {
    return NextResponse.redirect(new URL('/household', request.url))
  }

  const admin = supabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const form = await request.formData().catch(() => null)
  const name = (form?.get('name') as string | null)?.trim() || 'Our kitchen'

  const { data: household, error } = await admin
    .from('households')
    .insert({ name: name.slice(0, 60), owner_id: user.id, invite_code: generateInviteCode() })
    .select('id')
    .single()
  if (error || !household) {
    console.error('[household] create failed:', error)
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }

  const { error: memberErr } = await admin
    .from('household_members')
    .insert({ household_id: household.id, user_id: user.id, role: 'owner' })
  if (memberErr) {
    // Roll back the orphaned household so a retry can succeed.
    await admin.from('households').delete().eq('id', household.id)
    console.error('[household] owner membership failed:', memberErr)
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }

  return NextResponse.redirect(new URL('/household', request.url), { status: 303 })
}
