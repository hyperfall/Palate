import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client for route handlers — reads the session from
 * request cookies (kept fresh by proxy.ts). Null until env is configured.
 */
export async function supabaseServer(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const store = await cookies()
  return createServerClient(new URL(url).origin, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: () => {
        // Route handlers don't need to write auth cookies; proxy.ts refreshes.
      },
    },
  })
}

/** The signed-in user, or null. */
export async function serverUser(): Promise<User | null> {
  const supabase = await supabaseServer()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  return data.user ?? null
}

export function isCreator(user: User | null): boolean {
  return user?.user_metadata?.account_type === 'creator'
}
