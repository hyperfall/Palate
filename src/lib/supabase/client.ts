'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client. Identity and saved-recipe collections live in
 * Supabase; recipe content stays in Payload/Postgres. Returns null until the
 * env keys are set, so every consumer degrades to a "connect Supabase" state
 * instead of crashing — the site never depends on accounts to cook.
 */
let cached: SupabaseClient | null | undefined

export function supabaseBrowser(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // People paste the REST endpoint from the dashboard (…/rest/v1/) as often
  // as the project URL. The client needs the bare origin — normalise so a
  // pasted path can never silently break auth.
  const origin = url ? new URL(url).origin : null
  cached = origin && key ? createBrowserClient(origin, key) : null
  return cached
}

export type Collection = {
  id: string
  name: string
  created_at: string
}

export type SavedItem = {
  id: string
  collection_id: string
  recipe_slug: string
  recipe_title: string
  recipe_image: string | null
  created_at: string
}
