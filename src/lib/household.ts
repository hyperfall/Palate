import { supabaseServer } from '@/lib/supabase/server'

/**
 * Household context helpers. A household shares one meal plan, pantry and
 * shopping list; membership is one-per-user in v1. The DB trigger stamps
 * `household_id` on writes, so these helpers exist to SCOPE READS to the active
 * context (the household when a member, otherwise personal rows only).
 */

export type HouseholdMember = { userId: string; role: string; joinedAt: string }
export type HouseholdContext = {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  members: HouseholdMember[]
  isOwner: boolean
}

/** The signed-in user's household id, or null (personal scope). */
export async function getActiveHouseholdId(): Promise<string | null> {
  const supabase = await supabaseServer()
  if (!supabase) return null
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  if (!data.user) return null
  const { data: row } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', data.user.id)
    .maybeSingle()
  return (row?.household_id as string | undefined) ?? null
}

/** Full household + members for the /household management page, or null. */
export async function getHouseholdContext(): Promise<HouseholdContext | null> {
  const supabase = await supabaseServer()
  if (!supabase) return null
  const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  const user = userData.user
  if (!user) return null

  const { data: household } = await supabase
    .from('households')
    .select('id, name, owner_id, invite_code')
    .maybeSingle() // RLS returns only the viewer's household
  if (!household) return null

  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, role, joined_at')
    .order('joined_at')

  return {
    id: household.id as string,
    name: household.name as string,
    ownerId: household.owner_id as string,
    inviteCode: household.invite_code as string,
    isOwner: household.owner_id === user.id,
    members: (members ?? []).map((m) => ({
      userId: m.user_id as string,
      role: m.role as string,
      joinedAt: m.joined_at as string,
    })),
  }
}

/** A readable, unguessable invite code (no ambiguous chars). */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}
