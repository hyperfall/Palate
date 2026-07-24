import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS. Server-only, for writes the
 * client is deliberately not allowed to make (the Stripe webhook's
 * subscriptions upsert; household creation). Null until the service key is
 * configured. NEVER import from client components.
 */
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(new URL(url).origin, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
