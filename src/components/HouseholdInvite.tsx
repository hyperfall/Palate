'use client'

import { useState } from 'react'

/**
 * Copyable invite: shows the join link and code, copies to clipboard on click.
 * Presentation only — the code comes from the server.
 */
export function HouseholdInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window !== 'undefined' ? `${window.location.origin}/household/join/${code}` : `/household/join/${code}`

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="grid gap-1">
      <span className="eyebrow">Invite link</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-rule bg-transparent px-2 py-1 font-mono text-caption text-ink"
        />
        <button type="button" onClick={() => void copy()} className="chip">
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <span className="font-mono text-tag tracking-[0.1em] text-slate uppercase">
        or share the code · {code}
      </span>
    </div>
  )
}
