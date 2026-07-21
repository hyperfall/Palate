import { NextResponse, type NextRequest } from 'next/server'

import { findAuthorByHandle } from '@/lib/queries'
import { serverUser, supabaseServer } from '@/lib/supabase/server'
import { normalizeUsername, validateUsername } from '@/lib/username'

/**
 * Live username availability, the Instagram-style typeahead check.
 *
 * Authoritative source is the `usernames` reservation table, queried through the
 * leak-free `username_available` RPC (excludes the caller's own row via
 * auth.uid()). We also check the legacy `authors.handle` namespace for creators
 * whose handle predates the reservation table. The check is advisory — the
 * UNIQUE constraint enforced by /account/username is the real guarantee.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const username = normalizeUsername(request.nextUrl.searchParams.get('u') ?? '')

  const format = validateUsername(username)
  if (!format.ok) {
    return NextResponse.json({ username, available: false, reason: format.reason })
  }

  const user = await serverUser()

  // 1) Reservation table. The RPC already excludes the caller's own handle, so a
  //    `false` here means someone else holds it. Errors (RPC not yet migrated,
  //    Supabase unreachable) fall through to the legacy check below.
  const supabase = await supabaseServer()
  if (supabase) {
    const { data, error } = await supabase.rpc('username_available', { candidate: username })
    if (!error && data === false) {
      return NextResponse.json({ username, available: false, reason: 'Taken.' })
    }
  }

  // 2) Legacy published handle not tied to a reservation row.
  const author = await findAuthorByHandle(username)
  if (author) {
    const mine = Boolean(user && author.creatorId && author.creatorId === user.id)
    return NextResponse.json({
      username,
      available: mine,
      mine,
      ...(mine ? {} : { reason: 'Taken.' }),
    })
  }

  return NextResponse.json({ username, available: true })
}
