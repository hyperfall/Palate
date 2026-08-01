'use client'

import { useEffect, useState } from 'react'
import { SettingsSection } from '@/components/account/SettingsSection'
import { SocialLinksField } from '@/components/account/SocialLinksField'

/** Bio length cap, matched by the server route that stores it. */
const BIO_MAX = 160

export function BioField() {
  const [state, setState] = useState<{ show: boolean; hasProfile: boolean }>({ show: false, hasProfile: false })
  const [bio, setBio] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/account/bio')
      .then((r) => r.json())
      .then((d: { creator?: boolean; hasProfile?: boolean; bio?: string }) => {
        if (!active) return
        setState({ show: Boolean(d.creator), hasProfile: Boolean(d.hasProfile) })
        setBio(d.bio ?? '')
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  if (!state.show) return null

  const save = async () => {
    setStatus('saving')
    setError(null)
    try {
      const res = await fetch('/account/bio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bio }),
      })
      if (res.ok) {
        setStatus('saved')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Couldn’t save your bio — try again.')
        setStatus('idle')
      }
    } catch {
      setError('Couldn’t save your bio — check your connection.')
      setStatus('idle')
    }
  }

  return (
    <SettingsSection
      title="Creator profile"
      desc="Your public byline — the bio and links shown wherever your recipes appear."
    >
      {state.hasProfile ? (
        <div className="grid gap-1">
          <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">Bio</span>
          <textarea
            value={bio}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="A line about you and your cooking."
            onChange={(e) => {
              setBio(e.target.value)
              setStatus('idle')
            }}
            className="resize-none rounded border border-rule bg-transparent px-3 py-2 font-body text-[0.9375rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => void save()}
              disabled={status === 'saving'}
              className="chip w-fit disabled:opacity-60"
            >
              {status === 'saved' ? '✓ Saved' : status === 'saving' ? 'Saving…' : 'Save bio'}
            </button>
            <span className="font-mono text-[0.75rem] text-slate">
              {bio.length}/{BIO_MAX}
            </span>
          </div>
          {error && <span className="font-mono text-[0.75rem] text-heat">{error}</span>}
          <SocialLinksField />
        </div>
      ) : (
        <p className="m-0 text-[0.8125rem] text-slate">
          Publish your first recipe to open your creator profile, then add a bio here.
        </p>
      )}
    </SettingsSection>
  )
}

/**
 * Self-service social links for creators. Loads current links, validates each on
 * the client before saving, and surfaces the server's per-link error.
 */
