'use client'

import { useEffect, useState } from 'react'

import type { TasteVector } from './tasteProfile'

const KEY = 'palate:taste'
const EVENT = 'palate:taste-change'

function read(): TasteVector | null {
  if (typeof window === 'undefined') return null
  try {
    const s = window.localStorage.getItem(KEY)
    return s ? (JSON.parse(s) as TasteVector) : null
  } catch {
    return null
  }
}

/** One-shot read of the saved profile, for non-hook call sites (event handlers). */
export function readTasteProfile(): TasteVector | null {
  return read()
}

/**
 * The visitor's saved taste profile (from the /taste onboarding), shared across
 * every component that personalises from it — /tonight and the catalog sort.
 * localStorage-backed with a custom event so all mounted instances stay in sync.
 * SSR-safe: null until mount.
 */
export function useTasteProfile(): readonly [TasteVector | null, (v: TasteVector | null) => void] {
  const [profile, setProfile] = useState<TasteVector | null>(null)

  useEffect(() => {
    setProfile(read())
    const sync = () => setProfile(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = (v: TasteVector | null) => {
    try {
      if (v) window.localStorage.setItem(KEY, JSON.stringify(v))
      else window.localStorage.removeItem(KEY)
    } catch {
      // Storage unavailable — the value still applies for this session.
    }
    setProfile(v)
    window.dispatchEvent(new Event(EVENT))
  }

  return [profile, update] as const
}
