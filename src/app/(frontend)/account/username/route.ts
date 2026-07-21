import { NextResponse, type NextRequest } from 'next/server'

import { findAuthorByHandle } from '@/lib/queries'
import { serverUser, supabaseServer } from '@/lib/supabase/server'
import { normalizeUsername, validateUsername } from '@/lib/username'

/**
 * Claim (or clear) a username. The live check is advisory; this is where the
 * name is actually reserved. The UNIQUE constraint on `usernames.username`
 * settles races atomically — two people racing for the same handle, only one
 * insert survives and the loser gets 409. The Supabase user metadata is kept in
 * sync so the handle shows on the profile and rides along on recipe submissions.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await serverUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const supabase = await supabaseServer()
  if (!supabase) return NextResponse.json({ error: 'Accounts are not configured.' }, { status: 503 })

  const body = (await request.json().catch(() => null)) as { username?: unknown } | null
  const username = normalizeUsername(typeof body?.username === 'string' ? body.username : '')

  // Empty clears the reservation and the stored handle.
  if (username === '') {
    await supabase.from('usernames').delete().eq('user_id', user.id)
    await supabase.auth.updateUser({ data: { username: null } })
    return NextResponse.json({ ok: true, username: null })
  }

  const format = validateUsername(username)
  if (!format.ok) return NextResponse.json({ error: format.reason }, { status: 422 })

  // A legacy published handle owned by someone else would collide at publish —
  // block it here too, not just at promotion.
  const author = await findAuthorByHandle(username)
  if (author && !(author.creatorId && author.creatorId === user.id)) {
    return NextResponse.json({ error: 'Taken.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('usernames')
    .upsert(
      { user_id: user.id, username, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) {
    // 23505 = unique_violation on the username constraint: held by another user.
    if (error.code === '23505') return NextResponse.json({ error: 'Taken.' }, { status: 409 })
    return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 })
  }

  // Sync metadata for display + submit-time creatorHandle. Non-fatal if it fails.
  await supabase.auth.updateUser({ data: { username } }).catch(() => {})

  return NextResponse.json({ ok: true, username })
}
