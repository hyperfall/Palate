'use client'

import { useEffect, useState } from 'react'

import type { UnitSystem } from './units'

const KEY = 'palate:units'
const EVENT = 'palate:units-change'

function read(): UnitSystem {
  if (typeof window === 'undefined') return 'metric'
  try {
    return window.localStorage.getItem(KEY) === 'us' ? 'us' : 'metric'
  } catch {
    // Safari private mode / storage disabled — fall back to the default.
    return 'metric'
  }
}

/**
 * The reader's US/metric preference, shared across every component that shows
 * measures or step text. Backed by localStorage; a custom event keeps all
 * mounted instances in lockstep (the native `storage` event only fires across
 * tabs, not within one). SSR-safe: defaults to metric until mount.
 */
export function useUnitSystem(): readonly [UnitSystem, (next: UnitSystem) => void] {
  const [system, setSystem] = useState<UnitSystem>('metric')

  useEffect(() => {
    setSystem(read())
    const sync = () => setSystem(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = (next: UnitSystem) => {
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
    setSystem(next)
    window.dispatchEvent(new Event(EVENT))
  }

  return [system, update] as const
}
