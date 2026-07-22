'use client'

import { supabaseBrowser } from '@/lib/supabase/client'
import type { TasteVector } from './tasteProfile'

/**
 * Supabase-backed taste profile (one row per user, RLS-scoped). Replaces the
 * old localStorage store — the profile now persists to the account. Both calls
 * no-op to null/false when signed out or Supabase is unconfigured.
 */
export async function saveTasteProfile(v: TasteVector): Promise<boolean> {
  const supabase = supabaseBrowser()
  if (!supabase) return false
  const { error } = await supabase.from('taste_profile').upsert(
    { spiciness: v.spiciness, sweetness: v.sweetness, richness: v.richness, effort: v.effort },
    { onConflict: 'user_id' },
  )
  return !error
}

export async function fetchTasteProfile(): Promise<TasteVector | null> {
  const supabase = supabaseBrowser()
  if (!supabase) return null
  const { data } = await supabase
    .from('taste_profile')
    .select('spiciness,sweetness,richness,effort')
    .maybeSingle()
  if (!data) return null
  return {
    spiciness: data.spiciness as number,
    sweetness: data.sweetness as number,
    richness: data.richness as number,
    effort: data.effort as number,
  }
}
