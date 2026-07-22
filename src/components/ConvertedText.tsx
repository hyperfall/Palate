'use client'

import { convertTemperatures } from '@/lib/units'
import { useUnitSystem } from '@/lib/useUnitSystem'

/**
 * Renders text with oven temperatures converted to the reader's US/metric
 * preference — the same shared setting the ingredients panel and cooking mode
 * use. Applied to on-page method steps so "Bake at 350°F" flips with the toggle
 * instead of only the ingredient measures converting. SSR-safe (defaults to
 * metric until mount, matching the shared hook).
 */
export function ConvertedText({ text }: { text: string }) {
  const [system] = useUnitSystem()
  return <>{convertTemperatures(text, system)}</>
}
