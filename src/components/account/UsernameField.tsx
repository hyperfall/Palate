'use client'

import { useEffect, useState } from 'react'

import { normalizeUsername, validateUsername } from '@/lib/username'

/**
 * Username with a live availability check (Instagram-style). Input normalizes as
 * you type; a debounced call to /account/username-available reports available /
 * taken / invalid against the unique public-handle namespace. The change only
 * persists on blur, and only when the name is actually free.
 */
type CheckState = { kind: 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' | 'saved'; msg?: string }

export function UsernameField({
  initial,
  onSave,
}: {
  initial: string | null
  /** Persists the handle; resolves false if the server rejected it (e.g. taken). */
  onSave: (username: string | null) => Promise<boolean>
}) {
  const [value, setValue] = useState(initial ?? '')
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' })

  useEffect(() => {
    const name = normalizeUsername(value)
    // Unchanged or empty → nothing to check; empty clears the handle on save.
    if (name === (initial ?? '') || name === '') {
      setCheck({ kind: 'idle' })
      return
    }
    const format = validateUsername(name)
    if (!format.ok) {
      setCheck({ kind: 'invalid', msg: format.reason })
      return
    }
    setCheck({ kind: 'checking' })
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/account/username-available?u=${encodeURIComponent(name)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { available: boolean; reason?: string }
        setCheck(data.available ? { kind: 'ok' } : { kind: 'taken', msg: data.reason ?? 'Taken.' })
      } catch {
        // Aborted by the next keystroke — ignore.
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, initial])

  const name = normalizeUsername(value)
  const commit = async () => {
    if (check.kind !== 'ok') return
    // The race the live check can't see is settled here by the server.
    const ok = await onSave(name || null)
    setCheck(ok ? { kind: 'saved' } : { kind: 'taken', msg: 'Just taken. Try another.' })
  }

  const tone =
    check.kind === 'ok' || check.kind === 'saved'
      ? 'text-richness'
      : check.kind === 'taken' || check.kind === 'invalid'
        ? 'text-heat'
        : 'text-slate'
  const message =
    check.kind === 'checking'
      ? 'Checking…'
      : check.kind === 'ok'
        ? `@${name} is available`
        : check.kind === 'saved'
          ? 'Saved.'
          : check.kind === 'taken' || check.kind === 'invalid'
            ? check.msg
            : null

  return (
    <label className="grid gap-1">
      <span className="eyebrow">Username</span>
      <input
        type="text"
        value={value}
        maxLength={30}
        placeholder="your-handle"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={check.kind === 'taken' || check.kind === 'invalid'}
        onChange={(e) => setValue(normalizeUsername(e.target.value))}
        onBlur={commit}
        className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-eyebrow text-ink focus:border-flame focus:outline-none"
      />
      {message && (
        <span className={`font-mono text-caption ${tone}`} role="status" aria-live="polite">
          {message}
        </span>
      )}
    </label>
  )
}

/**
 * Self-service bio, for creators. Loads the current bio (from their author
 * profile) on mount and self-hides for non-creators or before a profile exists;
 * saves on the button, character-capped Instagram-style.
 */
