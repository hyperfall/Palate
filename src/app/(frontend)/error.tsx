'use client'

import { useEffect } from 'react'

/** Client error boundary in the house voice — never a raw stack trace. */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Surfaced to the console for debugging; the reader gets the calm version.
    console.error(error)
  }, [error])

  return (
    <div className="shell grid min-h-[60vh] place-items-center py-16">
      <div className="ticket-card max-w-[34rem] p-8 text-center">
        <p className="eyebrow m-0 text-flame">Something spat in the pan</p>
        <h1 className="mt-2 font-display text-[clamp(1.75rem,3.5vw,2.75rem)]">
          That didn’t plate up.
        </h1>
        <p className="mx-auto mt-3 max-w-[38ch] text-slate">
          A step went wrong on our side. Give it another go. Most of the time the second
          attempt lands clean.
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-7">
          Try again
        </button>
      </div>
    </div>
  )
}
