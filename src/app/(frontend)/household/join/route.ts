import { NextResponse, type NextRequest } from 'next/server'

import { limited } from '@/lib/rateLimit'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Join a household by invite code via the security-definer RPC (validates the
 * code, refuses if already in a household). Runs as the signed-in user so the
 * new membership row is genuinely theirs.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Invite codes are 40-bit — not brute-forceable at 20 tries / 10 min, but only with a throttle.
  const rl = limited(request, { name: 'household-join', limit: 20, windowMs: 10 * 60_000 })
  if (rl) return rl
  const supabase = await supabaseServer()
  if (!supabase) return NextResponse.redirect(new URL('/account', request.url))

  const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!userData.user) return NextResponse.redirect(new URL('/account', request.url))

  const form = await request.formData().catch(() => null)
  const code = (form?.get('code') as string | null)?.trim().toUpperCase()
  if (!code) return NextResponse.redirect(new URL('/household', request.url))

  const { error } = await supabase.rpc('join_household', { code })
  if (error) {
    const reason = /already/.test(error.message) ? 'already' : 'invalid'
    return NextResponse.redirect(new URL(`/household?join=${reason}`, request.url), { status: 303 })
  }

  return NextResponse.redirect(new URL('/plan', request.url), { status: 303 })
}
