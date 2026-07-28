'use client'

import { useEffect, useState } from 'react'

/**
 * Send the recipe to paper. The print stylesheet does the work — this only
 * offers the door, because a cook has no reason to guess that Ctrl+P produces
 * a clean kitchen card rather than the whole site.
 *
 * Hidden until mount: printing needs a real browser, and rendering it during
 * SSR would flash a control that does nothing. It also hides itself in print,
 * via the same rule that drops every other button from the sheet.
 */
export function PrintRecipe() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.75rem] tracking-[0.12em] text-milk/70 uppercase underline-offset-4 hover:text-milk hover:underline"
    >
      Print
    </button>
  )
}
