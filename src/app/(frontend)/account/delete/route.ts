import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { serverUser } from '@/lib/supabase/server'

/**
 * Right-to-erasure. Auth deletion needs the service role (the anon client can
 * never delete users), and every user-owned table references auth.users with
 * ON DELETE CASCADE — so removing the auth user removes the person's data in
 * one stroke. Without the key configured we say so instead of pretending.
 */
export async function POST() {
  const user = await serverUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Deletion isn’t switched on yet. The server needs SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 501 },
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
