'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

import { ImagePicker } from '@/components/ImagePicker'
import { scorePassword } from '@/lib/passwordStrength'
import { isValidSocial, SOCIAL_PLATFORMS } from '@/lib/socials'
import { ThemeToggle } from '@/components/ThemeToggle'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useUnitSystem } from '@/lib/useUnitSystem'
import { normalizeUsername, validateUsername } from '@/lib/username'

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'recovery'

type SessionInfo = {
  email: string
  name: string | null
  since: string | null
  username: string | null
  avatarUrl: string | null
  creator: boolean
}

/**
 * Username with a live availability check (Instagram-style). Input normalizes as
 * you type; a debounced call to /account/username-available reports available /
 * taken / invalid against the unique public-handle namespace. The change only
 * persists on blur, and only when the name is actually free.
 */
type CheckState = { kind: 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' | 'saved'; msg?: string }

function UsernameField({
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
    setCheck(ok ? { kind: 'saved' } : { kind: 'taken', msg: 'Just taken — try another.' })
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
        className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-[0.875rem] text-ink focus:border-flame focus:outline-none"
      />
      {message && (
        <span className={`font-mono text-[0.75rem] ${tone}`} role="status" aria-live="polite">
          {message}
        </span>
      )}
    </label>
  )
}

const BIO_MAX = 160

/**
 * Self-service bio, for creators. Loads the current bio (from their author
 * profile) on mount and self-hides for non-creators or before a profile exists;
 * saves on the button, character-capped Instagram-style.
 */
function BioField() {
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
function SocialLinksField() {
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
function SettingsSection({
  title,
  desc,
  tone = 'default',
  children,
}: {
  title: string
  desc?: string
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <div
      className={`mt-6 grid gap-4 border-t pt-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 ${
        tone === 'danger' ? 'border-heat/40' : 'border-rule'
      }`}
    >
      <div>
        <p className={`eyebrow m-0 ${tone === 'danger' ? 'text-heat' : ''}`}>{title}</p>
        {desc && <p className="mt-1.5 text-[0.8125rem] leading-snug text-slate lg:max-w-[22ch]">{desc}</p>}
      </div>
      <div className="grid min-w-0 content-start gap-4">{children}</div>
    </div>
  )
}

/** Shared look for a save chip that reports its own lifecycle. */
function SaveChip({
  status,
  label,
  onClick,
}: {
  status: 'idle' | 'saving' | 'saved'
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={status === 'saving'} className="chip w-fit disabled:opacity-60">
      {status === 'saved' ? '✓ Saved' : status === 'saving' ? 'Saving…' : label}
    </button>
  )
}

/**
 * Display name — shown on every byline and greeting, previously set once at
 * sign-up and then frozen. Saves to auth metadata; the header above updates
 * through the onSaved callback so the page never shows two different names.
 */
function DisplayNameField({ initial, onSaved }: { initial: string | null; onSaved: (name: string) => void }) {
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
      setError('Couldn’t save your name — try again.')
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
        className="rounded border border-rule bg-transparent px-3 py-2 font-body text-[0.9375rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
      />
      {dirty && <SaveChip status={status} label="Save name" onClick={() => void save()} />}
      {error && <span className="font-mono text-[0.75rem] text-heat">{error}</span>}
    </label>
  )
}

/**
 * How the kitchen reads to you: measures, theme, and the two personalisation
 * surfaces (taste quiz, pantry) that live on their own pages. The units choice
 * also saves to the account so a new device starts where this one left off.
 */
function PreferencesSection() {
  const supabase = supabaseBrowser()
  const [units, setUnits] = useUnitSystem()

  const pick = (next: 'metric' | 'us') => {
    setUnits(next)
    // Fire-and-forget: localStorage is the source of truth for this device;
    // the account copy only seeds devices that haven't chosen yet.
    void supabase?.auth.updateUser({ data: { unit_system: next } }).catch(() => {})
  }

  return (
    <SettingsSection
      title="Cooking preferences"
      desc="How recipes read to you — here and on your other devices."
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">Measures</span>
        <div className="flex gap-2">
          <button type="button" className="chip" data-active={units === 'metric'} onClick={() => pick('metric')}>
            Metric
          </button>
          <button type="button" className="chip" data-active={units === 'us'} onClick={() => pick('us')}>
            US cups
          </button>
        </div>
        <span className="text-[0.8125rem] text-slate">Applies to every recipe, on this and future devices.</span>
      </div>
      <div className="grid gap-1.5">
        <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">Theme</span>
        <ThemeToggle colorClass="border-rule text-ink" />
      </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link
          href="/taste"
          className="font-mono text-[0.8125rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
        >
          Retake the taste quiz →
        </Link>
        <Link
          href="/cook-from"
          className="font-mono text-[0.8125rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
        >
          Manage your pantry →
        </Link>
      </div>
    </SettingsSection>
  )
}

/**
 * Email and password changes, signed in — previously the only path to either
 * was the sign-out-and-recover loop. Email change goes through Supabase's
 * double confirmation; password reuses the same strength gate as sign-up.
 */
function SecuritySection({ currentEmail }: { currentEmail: string }) {
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
        <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">Email</span>
        <input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => {
            setEmail(e.target.value)
            setEmailStatus('idle')
          }}
          className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-[0.875rem] text-ink focus:border-flame focus:outline-none"
        />
        {emailStatus === 'sent' ? (
          <span className="font-mono text-[0.75rem] text-richness" role="status">
            Confirmation links sent to both addresses — the change applies once confirmed.
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
          <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">New password</span>
          {password && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.75rem] tracking-[0.1em] text-slate uppercase hover:text-ink"
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
          placeholder="Leave empty to keep your current one"
          onChange={(e) => {
            setPassword(e.target.value)
            setPwStatus('idle')
          }}
          className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-[0.875rem] text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
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
        <p className="m-0 font-mono text-[0.75rem] text-heat" role="alert">
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
function DangerZone() {
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
            className="w-fit cursor-pointer rounded border border-heat/50 bg-transparent px-3 py-1.5 font-mono text-[0.75rem] tracking-[0.1em] text-heat uppercase hover:bg-heat/10"
          >
            Delete my account
          </button>
          <span className="text-[0.8125rem] text-slate">
            Removes your account, saved recipes, plans, pantry and taste profile. Published recipes
            stay live under your byline unless you unpublish them first.
          </span>
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="grid gap-1">
            <span className="text-[0.8125rem] text-slate">
              This can’t be undone. Type <strong className="font-mono text-ink">DELETE</strong> to confirm.
            </span>
            <input
              type="text"
              value={confirm}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-40 rounded border border-heat/50 bg-transparent px-3 py-1.5 font-mono text-[0.875rem] text-ink focus:border-heat focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={confirm !== 'DELETE' || busy}
              onClick={() => void destroy()}
              className="w-fit cursor-pointer rounded border border-heat bg-heat px-3 py-1.5 font-mono text-[0.75rem] tracking-[0.1em] text-paper uppercase disabled:cursor-not-allowed disabled:opacity-40"
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
              className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.75rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:underline"
            >
              Keep my account
            </button>
          </div>
          {error && (
            <p className="m-0 font-mono text-[0.75rem] text-heat" role="alert">
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
export function AccountPanel() {
  const supabase = supabaseBrowser()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [accountType, setAccountType] = useState<'cook' | 'creator'>('cook')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setChecked(true)
      return
    }

    const readUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data.user
        setSession(
          user
            ? {
                email: user.email ?? '',
                name: (user.user_metadata?.display_name as string | undefined) ?? null,
                since: user.created_at ?? null,
                username: (user.user_metadata?.username as string | undefined) ?? null,
                avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
                creator: user.user_metadata?.account_type === 'creator',
              }
            : null,
        )
        if (user) {
          const { count } = await supabase
            .from('collection_items')
            .select('id', { count: 'exact', head: true })
          setSavedCount(count ?? 0)
        }
      } catch {
        // A failed check falls back to the signed-out form instead of leaving
        // the panel blank forever (`checked` still flips below).
        setSession(null)
      } finally {
        setChecked(true)
      }
    }

    void readUser()

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Arriving from a reset email fires PASSWORD_RECOVERY — show the form.
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery')
        setNotice({ kind: 'info', text: 'Set a new password to finish.' })
      }
      void readUser()
    })
    return () => sub.subscription.unsubscribe()
     
  }, [supabase])

  if (!supabase) {
    return (
      <div className="ticket-card is-static max-w-[36rem] p-6">
        <p className="eyebrow m-0 text-flame">Not connected yet</p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">
          Accounts run on Supabase. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env</code>, run{' '}
          <code>supabase/schema.sql</code> in the SQL editor once, and restart the dev server.
        </p>
      </div>
    )
  }

  if (!checked) return null

  // ---- Signed-in profile ---------------------------------------------------
  if (session && mode !== 'recovery') {
    return (
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:items-start">
      <div className="ticket-card is-static max-w-[60rem] p-6 sm:p-8">
        <div className="flex items-center gap-4">
          {session.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- account avatar from media API
            <img src={session.avatarUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-full border border-rule object-cover" />
          ) : (
            <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full border border-rule bg-wash font-display text-xl">
              {(session.name ?? session.email)[0]?.toUpperCase()}
            </span>
          )}
          <div>
            <p className="eyebrow m-0">Signed in as</p>
            <h2 className="mt-0.5 text-[1.5rem]">{session.name ?? session.email}</h2>
            {session.username && (
              <p className="m-0 font-mono text-[0.8125rem] text-slate">@{session.username}</p>
            )}
          </div>
        </div>

        <SettingsSection title="Profile" desc="Your name and handle, as every byline reads them.">
          <DisplayNameField
            initial={session.name}
            onSaved={(name) => setSession((prev) => (prev ? { ...prev, name } : prev))}
          />

        <div className="grid gap-3 sm:grid-cols-2">
          <UsernameField
            initial={session.username ?? null}
            onSave={async (username) => {
              // Reserve server-side first — the unique constraint is the guard.
              const res = await fetch('/account/username', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ username }),
              })
              if (!res.ok) return false
              setSession((prev) => (prev ? { ...prev, username } : prev))
              return true
            }}
          />
          <div className="grid gap-1">
            <span className="eyebrow">Avatar</span>
            <ImagePicker
              aspect={1}
              round
              compact
              onCropped={async (file) => {
                const form = new FormData()
                form.set('avatar', file)
                try {
                  const res = await fetch('/account/avatar', { method: 'POST', body: form })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error)
                  await supabase.auth.updateUser({
                    data: { avatar_url: data.url, avatar_media_id: data.id },
                  })
                  setSession((prev) => (prev ? { ...prev, avatarUrl: data.url } : prev))
                } catch {
                  setNotice({ kind: 'error', text: 'Avatar upload failed — try a smaller image.' })
                }
              }}
            />
          </div>
        </div>
        </SettingsSection>

        <BioField />
        <PreferencesSection />
        <SecuritySection currentEmail={session.email} />
        <DangerZone />
      </div>

      {/* The account rail: facts and actions, docked beside the profile where
          the page previously ran empty. Sticky so it rides along on lg. */}
      <aside className="ticket-card is-static p-5 sm:p-6 xl:sticky xl:top-24">
        <p className="eyebrow m-0">Your account</p>
        <dl className="m-0 mt-4 grid gap-2">
          <div className="leader">
            <dt className="eyebrow">Email</dt>
            <span className="leader__dots" aria-hidden="true" />
            <dd className="datum m-0">{session.email}</dd>
          </div>
          {session.since && (
            <div className="leader">
              <dt className="eyebrow">On the pass since</dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0">
                {new Date(session.since).toLocaleDateString('en-GB', {
                  month: 'short',
                  year: 'numeric',
                })}
              </dd>
            </div>
          )}
          {savedCount !== null && (
            <div className="leader">
              <dt className="eyebrow">Saved recipes</dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0">{savedCount}</dd>
            </div>
          )}
          <div className="leader">
            <dt className="eyebrow">Account</dt>
            <span className="leader__dots" aria-hidden="true" />
            <dd className="datum m-0">{session.creator ? 'Creator' : 'Cook'}</dd>
          </div>
        </dl>

        {!session.creator && (
          <div className="mt-4 grid gap-1.5 rounded border border-flame/40 bg-flame/5 p-3">
            <p className="m-0 text-[0.875rem] font-semibold text-ink">Cooking things worth sharing?</p>
            <p className="m-0 text-[0.8125rem] leading-snug text-slate">
              Creator accounts publish recipes under their own byline.
            </p>
            <button
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.updateUser({ data: { account_type: 'creator' } })
                if (!error) setSession((prev) => (prev ? { ...prev, creator: true } : prev))
              }}
              className="chip mt-1 w-fit"
            >
              Become a creator →
            </button>
          </div>
        )}

        <div className="mt-5 grid gap-3 border-t border-rule pt-5">
          <Link href="/collections" className="btn-primary text-center">
            My collections →
          </Link>
          <Link
            href="/feed"
            className="font-mono text-[0.8125rem] tracking-[0.12em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
          >
            Your feed →
          </Link>
        </div>

        {/* Leaving is quiet and set apart — never adjacent to the primary CTA. */}
        <button
          type="button"
          onClick={async () => {
            try {
              await supabase.auth.signOut()
            } catch {
              // Local session state still clears below even if the network
              // call to revoke it server-side failed.
            }
            setSession(null)
            setSavedCount(null)
          }}
          className="mt-6 w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-[0.75rem] tracking-[0.12em] text-slate uppercase underline-offset-4 hover:text-heat hover:underline"
        >
          Sign out
        </button>
      </aside>
      </div>
    )
  }

  // ---- Forms ---------------------------------------------------------------
  const strength = scorePassword(password, { email, name })
  const needsStrong = mode === 'sign-up' || mode === 'recovery'

  const fail = (error: unknown) =>
    setNotice({
      kind: 'error',
      // Network-level auth failures surface as Errors with empty messages —
      // never show a blank alert.
      text:
        (error instanceof Error && error.message) ||
        'Couldn’t reach the sign-in service — check the connection and try again.',
    })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Block weak passwords before they reach the auth service (which is also
    // the server-side backstop via Supabase's password policy).
    if (needsStrong && !strength.acceptable) {
      setNotice({ kind: 'error', text: strength.suggestions[0] ?? 'Choose a stronger password.' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() || null, account_type: accountType } },
        })
        if (error) throw error
        if (!data.session) {
          setNotice({
            kind: 'info',
            text: 'Almost there — confirm the link we just emailed you, then sign in.',
          })
        }
      } else if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/account`,
        })
        if (error) throw error
        setNotice({
          kind: 'info',
          text: 'Reset link sent — check your inbox and follow it back here.',
        })
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMode('sign-in')
        setNotice({ kind: 'info', text: 'Password updated — you’re signed in.' })
      }
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  const oauth = async (provider: 'google' | 'github') => {
    setNotice(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/account` },
    })
    if (error) fail(error)
  }

  const passwordField = (
    <label className="grid gap-1">
      <span className="flex items-baseline justify-between">
        <span className="eyebrow">{mode === 'recovery' ? 'New password' : 'Password'}</span>
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.1em] text-slate uppercase hover:text-ink"
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </span>
      <input
        type={showPassword ? 'text' : 'password'}
        required
        minLength={8}
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-[0.875rem] text-ink focus:border-flame focus:outline-none"
      />
      {needsStrong &&
        (password ? (
          <div className="grid gap-1">
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
            <span
              role="status"
              className={`font-mono text-[0.75rem] ${strength.acceptable ? 'text-slate' : 'text-heat'}`}
            >
              {strength.label}
              {strength.suggestions[0] ? ` — ${strength.suggestions[0]}` : ''}
            </span>
          </div>
        ) : (
          <span className="text-[0.8125rem] text-slate">At least 8 characters — longer is stronger.</span>
        ))}
    </label>
  )

  return (
    <div className="ticket-card is-static max-w-[36rem] p-6 sm:p-7">
      {mode !== 'recovery' && (
        <div className="flex flex-wrap gap-2">
          {(['sign-in', 'sign-up'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setNotice(null)
              }}
              className="chip"
              data-active={mode === m}
            >
              {m === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-5 grid gap-3.5">
        {mode === 'sign-up' && (
          <>
          <label className="grid gap-1">
            <span className="eyebrow">Name</span>
            <input
              type="text"
              autoComplete="name"
              maxLength={60}
              placeholder="What should we call you at the pass?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-[0.875rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
            />
          </label>

            <div className="grid gap-1.5">
              <span className="eyebrow">What brings you here?</span>
              <div className="flex gap-2">
                <button type="button" className="chip" aria-pressed={accountType === 'cook'} onClick={() => setAccountType('cook')}>
                  I’m here to cook
                </button>
                <button type="button" className="chip" aria-pressed={accountType === 'creator'} onClick={() => setAccountType('creator')}>
                  I’m a creator
                </button>
              </div>
            </div>
          </>
        )}

        {mode !== 'recovery' && (
          <label className="grid gap-1">
            <span className="eyebrow">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-[0.875rem] text-ink focus:border-flame focus:outline-none"
            />
          </label>
        )}

        {mode !== 'forgot' && passwordField}

        {notice && (
          <p
            className={`m-0 text-[0.875rem] leading-snug ${
              notice.kind === 'error' ? 'text-heat' : 'text-richness'
            }`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            {notice.text}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary mt-1 disabled:opacity-60">
          {busy
            ? 'One moment…'
            : mode === 'sign-in'
              ? 'Sign in'
              : mode === 'sign-up'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Set new password'}
        </button>

        {mode === 'sign-in' && (
          <button
            type="button"
            onClick={() => {
              setMode('forgot')
              setNotice(null)
            }}
            className="w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:underline"
          >
            Forgotten password?
          </button>
        )}
        {mode === 'forgot' && (
          <button
            type="button"
            onClick={() => {
              setMode('sign-in')
              setNotice(null)
            }}
            className="w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:underline"
          >
            ← Back to sign in
          </button>
        )}
      </form>

      {mode !== 'recovery' && (
        <div className="mt-6 border-t border-rule pt-5">
          <p className="eyebrow m-0">Or continue with</p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={() => void oauth('google')} className="chip">
              Google
            </button>
            <button type="button" onClick={() => void oauth('github')} className="chip">
              GitHub
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
