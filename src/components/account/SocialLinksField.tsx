'use client'

import {useEffect, useState} from 'react'

import { isValidSocial, SOCIAL_PLATFORMS } from '@/lib/socials'

export function SocialLinksField() {
  const [links, setLinks] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/account/socials')
      .then((r) => r.json())
      .then((d: { socials?: Record<string, string> }) => {
        if (active && d.socials) setLinks(d.socials)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const save = async () => {
    // Client-side validation mirrors the server so bad links are caught early.
    for (const p of SOCIAL_PLATFORMS) {
      if (!isValidSocial(links[p.key])) {
        setError(`That ${p.label} link doesn’t look like a valid URL.`)
        return
      }
    }
    setError(null)
    setStatus('saving')
    try {
      const res = await fetch('/account/socials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ socials: links }),
      })
      if (res.ok) {
        setStatus('saved')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Could not save your links.')
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  return (
    <div className="mt-3 grid gap-2">
      <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">Social links</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <label key={p.key} className="grid gap-1">
            <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">{p.label}</span>
            <input
              type="url"
              inputMode="url"
              value={links[p.key] ?? ''}
              placeholder={p.placeholder}
              onChange={(e) => {
                setLinks((prev) => ({ ...prev, [p.key]: e.target.value }))
                setStatus('idle')
                setError(null)
              }}
              className="w-full min-w-0 rounded border border-rule bg-transparent px-2 py-1.5 font-mono text-[0.8125rem] text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={status === 'saving'} className="chip w-fit disabled:opacity-60">
          {status === 'saved' ? '✓ Saved' : status === 'saving' ? 'Saving…' : 'Save links'}
        </button>
        {error && <span className="font-mono text-[0.75rem] text-heat">{error}</span>}
      </div>
    </div>
  )
}

/**
 * A settings row: the section's name and purpose in a left label column,
 * controls to the right — so the page reads as a ledger at desktop widths
 * instead of a single narrow stack. Collapses back to stacked below lg.
 */
