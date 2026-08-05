'use client'

import { useState } from 'react'

import { scorePassword } from '@/lib/passwordStrength'
import { supabaseBrowser } from '@/lib/supabase/client'
import { SaveChip, SettingsSection } from '@/components/account/SettingsSection'

export function SecuritySection({ currentEmail }: { currentEmail: string }) {
  const supabase = supabaseBrowser()
  const [email, setEmail] = useState(currentEmail)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'saving' | 'sent'>('idle')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const strength = scorePassword(password, { email })
  const emailDirty = email.trim() !== currentEmail && /.+@.+\..+/.test(email.trim())

  const saveEmail = async () => {
    if (!supabase || !emailDirty) return
    setEmailStatus('saving')
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ email: email.trim() })
    if (err) {
      setError(err.message || 'Couldn’t start the email change.')
      setEmailStatus('idle')
    } else {
      setEmailStatus('sent')
    }
  }

  const savePassword = async () => {
    if (!supabase) return
    if (!strength.acceptable) {
      setError(strength.suggestions[0] ?? 'Choose a stronger password.')
      return
    }
    setPwStatus('saving')
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message || 'Couldn’t change the password.')
      setPwStatus('idle')
    } else {
      setPwStatus('saved')
      setPassword('')
    }
  }

  return (
    <SettingsSection
      title="Security"
      desc="Email changes confirm at both addresses before they apply."
    >
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <label className="grid gap-1">
        <span className="font-mono text-tag tracking-[0.08em] text-slate uppercase">Email</span>
        <input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => {
            setEmail(e.target.value)
            setEmailStatus('idle')
          }}
          className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-eyebrow text-ink focus:border-flame focus:outline-none"
        />
        {emailStatus === 'sent' ? (
          <span className="font-mono text-caption text-richness" role="status">
            Confirmation links sent to both addresses. The change applies once confirmed.
          </span>
        ) : (
          emailDirty && (
            <SaveChip
              status={emailStatus === 'saving' ? 'saving' : 'idle'}
              label="Change email"
              onClick={() => void saveEmail()}
            />
          )
        )}
      </label>

      <label className="grid gap-1">
        <span className="flex items-baseline justify-between">
          <span className="font-mono text-tag tracking-[0.08em] text-slate uppercase">New password</span>
          {password && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="cursor-pointer border-none bg-transparent p-0 font-mono text-caption tracking-[0.1em] text-slate uppercase hover:text-ink"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        </span>
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          minLength={8}
          autoComplete="new-password"
          placeholder="New password"
          onChange={(e) => {
            setPassword(e.target.value)
            setPwStatus('idle')
          }}
          className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-eyebrow text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
        />
        {password && (
          <div className="grid gap-1.5">
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < strength.score
                      ? strength.score <= 1
                        ? 'bg-heat'
                        : strength.score === 2
                          ? 'bg-flame/60'
                          : 'bg-flame'
                      : 'bg-rule'
                  }`}
                />
              ))}
            </div>
            <SaveChip status={pwStatus} label="Change password" onClick={() => void savePassword()} />
          </div>
        )}
      </label>
      </div>

      {error && (
        <p className="m-0 font-mono text-caption text-heat" role="alert">
          {error}
        </p>
      )}
    </SettingsSection>
  )
}

/**
 * Deletion, armed in two steps: the first click only reveals the confirmation,
 * and nothing happens until the word is typed. Cascades in the schema take the
 * person's data with the auth user; the endpoint says so honestly when the
 * server isn't configured for it yet.
 */
