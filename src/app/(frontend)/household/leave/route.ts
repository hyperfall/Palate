import { NextResponse, type NextRequest } from 'next/server'

import { getHouseholdContext } from '@/lib/household'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Leave or disband a household. A member leaves (deletes their own membership,
 * allowed by RLS). The owner disbands: the whole household is deleted via the
 * service role, which cascades memberships and nulls household_id on shared
 * plan/pantry rows — everyone's personal week returns intact.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer()
  if (!supabase) return NextResponse.redirect(new URL('/account', request.url))

  const context = await getHouseholdContext()
  if (!context) return NextResponse.redirect(new URL('/household', request.url))

  if (context.isOwner) {
    const admin = supabaseAdmin()
    if (!admin) return NextResponse.json({ error: 'not configured' }, { status: 503 })
    await admin.from('households').delete().eq('id', context.id)
  } else {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id ?? ''
    // Take your data with you: rows the leaver owns must stop being visible to
    // the household they're leaving. Without this, the old household_id stays on
    // their plan/pantry rows and every remaining (or future) member keeps full
    // read/write over them indefinitely.
    await supabase.from('meal_plan').update({ household_id: null }).eq('user_id', uid).eq('household_id', context.id)
    await supabase.from('pantry').update({ household_id: null }).eq('user_id', uid).eq('household_id', context.id)
    await supabase.from('shopping_checks').delete().eq('user_id', uid).eq('household_id', context.id)
    await supabase.from('household_members').delete().eq('user_id', uid)
  }

  return NextResponse.redirect(new URL('/plan', request.url), { status: 303 })
}
