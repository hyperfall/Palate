'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * The shared "basket": which shopping-list items are checked off. Backed by the
 * `shopping_checks` table (RLS-scoped to you or your household), with optimistic
 * toggles and a realtime subscription so household members see each other tick
 * items live. Degrades to in-memory state when Supabase is unconfigured, so
 * Shopping Mode still works offline.
 *
 * Keys are the stable ShoppingLine.key (`id:<n>` / `name:<x>`).
 */
export function useShoppingChecks() {
  const supabase = supabaseBrowser()
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)
  // Configured-but-signed-out is its own case, and the one a shared week hits:
  // the client exists, so writes were attempted, RLS refused them, and every
  // tick silently reverted. A guest ticking a list in the aisle needs it to
  // work — in memory is the correct home for it.
  const [signedIn, setSignedIn] = useState(false)
  const [synced, setSynced] = useState(false)
  // Guards optimistic writes from being clobbered by a slightly-stale refetch.
  const localRef = useRef<Set<string>>(new Set())

  const apply = useCallback((next: Set<string>) => {
    localRef.current = next
    setChecked(next)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    let cancelled = false

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSignedIn(Boolean(data.user))
    })

    supabase
      .from('shopping_checks')
      .select('item_key')
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) apply(new Set(data.map((r) => r.item_key as string)))
        setReady(true)
      })

    const channel = supabase
      .channel('shopping_checks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shopping_checks' },
        (payload) => {
          const key = (payload.new as { item_key?: string }).item_key
          if (!key) return
          const next = new Set(localRef.current)
          next.add(key)
          apply(next)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'shopping_checks' },
        (payload) => {
          const key = (payload.old as { item_key?: string }).item_key
          if (!key) return
          const next = new Set(localRef.current)
          next.delete(key)
          apply(next)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSynced(true)
      })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [supabase, apply])

  const toggle = useCallback(
    async (key: string) => {
      const wasChecked = localRef.current.has(key)
      // Optimistic flip.
      const optimistic = new Set(localRef.current)
      if (wasChecked) optimistic.delete(key)
      else optimistic.add(key)
      apply(optimistic)

      // No account: the optimistic flip is the whole feature. Persisting would
      // be refused by RLS and would undo the tick the moment it failed.
      if (!supabase || !signedIn) return

      const { error } = wasChecked
        ? await supabase.from('shopping_checks').delete().eq('item_key', key)
        : await supabase.from('shopping_checks').insert({ item_key: key })

      // A unique-violation on insert just means someone already checked it —
      // the optimistic state is still correct, so only revert on other errors.
      if (error && !(error.code === '23505' && !wasChecked)) {
        const reverted = new Set(localRef.current)
        if (wasChecked) reverted.add(key)
        else reverted.delete(key)
        apply(reverted)
      }
    },
    // signedIn belongs here: without it the callback closes over the initial
    // false and would keep skipping the write after a session arrives.
    [supabase, apply, signedIn],
  )

  const clearAll = useCallback(async () => {
    const prev = localRef.current
    apply(new Set())
    if (!supabase || prev.size === 0) return
    // Delete everything in scope (a filter is required by the client).
    const { error } = await supabase.from('shopping_checks').delete().not('item_key', 'is', null)
    if (error) apply(prev)
  }, [supabase, apply])

  return { checked, ready, synced, toggle, clearAll }
}
