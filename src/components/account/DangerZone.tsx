'use client'

import { useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'
import { SettingsSection } from '@/components/account/SettingsSection'

export function DangerZone() {
  const supabase = supabaseBrowser()
  const [arming, setArming] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const destroy = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/account/delete', { method: 'POST' })
      if (res.ok) {
        await supabase?.auth.signOut().catch(() => {})
        window.location.assign('/')
        return
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string }
      setError(d.error ?? 'Couldn’t delete the account — try again.')
    } catch {
      setError('Couldn’t reach the server — check your connection.')
    }
    setBusy(false)
  }

  return (
    <SettingsSection tone="danger" title="Danger zone" desc="The way out — deliberate, never accidental.">
      {!arming ? (
        <div className="grid gap-1.5">
          <button
            type="button"
            onClick={() => setArming(true)}
            className="w-fit cursor-pointer rounded border border-heat/50 bg-transparent px-3 py-1.5 font-mono text-caption tracking-[0.1em] text-heat uppercase hover:bg-heat/10"
          >
            Delete my account
          </button>
          <span className="text-detail text-slate">
            Removes your account, saved recipes, plans, pantry and taste profile. Published recipes
            stay live under your byline unless you unpublish them first.
          </span>
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="grid gap-1">
            <span className="text-detail text-slate">
              This can’t be undone. Type <strong className="font-mono text-ink">DELETE</strong> to confirm.
            </span>
            <input
              type="text"
              value={confirm}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-40 rounded border border-heat/50 bg-transparent px-3 py-1.5 font-mono text-eyebrow text-ink focus:border-heat focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={confirm !== 'DELETE' || busy}
              onClick={() => void destroy()}
              className="w-fit cursor-pointer rounded border border-heat bg-heat px-3 py-1.5 font-mono text-caption tracking-[0.1em] text-paper uppercase disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
            <button
              type="button"
              onClick={() => {
                setArming(false)
                setConfirm('')
                setError(null)
              }}
              className="cursor-pointer border-none bg-transparent p-0 font-mono text-caption tracking-[0.1em] text-slate uppercase underline-offset-4 hover:underline"
            >
              Keep my account
            </button>
          </div>
          {error && (
            <p className="m-0 font-mono text-caption text-heat" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </SettingsSection>
  )
}

/**
 * The full account flow, still on one card: sign in, create account (with a
 * display name), show/hide password, forgot-password email, the recovery
 * form when someone arrives from that email, and OAuth. Signed in, it becomes
 * a small profile: name, email, member-since, saved count, sign out.
 *
 * OAuth buttons surface Supabase's own error if a provider isn't enabled in
 * the dashboard yet — better an honest message than a hidden feature.
 */
