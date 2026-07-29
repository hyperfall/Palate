'use client'

import { useEffect, useState } from 'react'

/**
 * The servings a recipe is currently scaled to, shared between every component
 * on the page that cares.
 *
 * The ingredients panel owns the stepper, but cook mode needs the same number:
 * showing a two-serving quantity to someone who scaled the dish to six is worse
 * than showing nothing, because it looks authoritative.
 *
 * Same shape as `useUnitSystem` — a module store plus a custom event, because
 * the native `storage` event only fires across tabs, not within one. Keyed by
 * slug so two recipes open in two tabs can't bleed into each other, and held in
 * memory only: a scaled serving count is about this cooking session, not a
 * preference worth remembering.
 */

const EVENT = 'palate:servings-change'
const store = new Map<string, number>()

type Update = number | ((prev: number) => number)

export function useServings(slug: string, base: number): readonly [number, (next: Update) => void] {
  const [servings, setServings] = useState(base)

  useEffect(() => {
    const sync = () => setServings(store.get(slug) ?? base)
    sync()
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [slug, base])

  // Accepts the functional form so callers can keep writing
  // `setServings((s) => s + 1)` — a stepper that reads the current value from a
  // stale closure would drop presses when tapped quickly.
  const update = (next: Update) => {
    const current = store.get(slug) ?? base
    const value = typeof next === 'function' ? next(current) : next
    store.set(slug, value)
    setServings(value)
    window.dispatchEvent(new Event(EVENT))
  }

  return [servings, update] as const
}
