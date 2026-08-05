'use client'

import { useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'
import { SaveChip } from '@/components/account/SettingsSection'

export function DisplayNameField({ initial, onSaved }: { initial: string | null; onSaved: (name: string) => void }) {
  const supabase = supabaseBrowser()
  const [value, setValue] = useState(initial ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  const dirty = value.trim() !== (initial ?? '') && value.trim() !== ''

  const save = async () => {
    if (!supabase || !dirty) return
    setStatus('saving')
    setError(null)
    const name = value.trim()
    const { error: err } = await supabase.auth.updateUser({ data: { display_name: name } })
    if (err) {
      setError('Couldn’t save your name. Try again.')
      setStatus('idle')
    } else {
      setStatus('saved')
      onSaved(name)
    }
  }

  return (
    <label className="grid gap-1">
      <span className="eyebrow">Display name</span>
      <input
        type="text"
        value={value}
        maxLength={60}
        autoComplete="name"
        placeholder="What should we call you at the pass?"
        onChange={(e) => {
          setValue(e.target.value)
          setStatus('idle')
        }}
        // Blur-saves like the username field beside it. A QA run typed a new
        // name, tabbed out expecting parity with its neighbour, and lost the
        // change silently — two adjacent fields must not have two save models.
        // The chip stays as the visible affordance and for anyone who expects
        // an explicit save.
        onBlur={() => void save()}
        className="rounded border border-rule bg-transparent px-3 py-2 font-body text-note text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
      />
      {dirty && <SaveChip status={status} label="Save name" onClick={() => void save()} />}
      {!dirty && status === 'saved' && (
        <span role="status" className="font-mono text-caption text-richness">
          Saved.
        </span>
      )}
      {error && <span className="font-mono text-caption text-heat">{error}</span>}
    </label>
  )
}

/**
 * How the kitchen reads to you: measures, theme, and the two personalisation
 * surfaces (taste quiz, pantry) that live on their own pages. The units choice
 * also saves to the account so a new device starts where this one left off.
 */
