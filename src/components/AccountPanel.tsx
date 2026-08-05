'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { ImagePicker } from '@/components/ImagePicker'
import { scorePassword } from '@/lib/passwordStrength'
import { supabaseBrowser } from '@/lib/supabase/client'

import { UsernameField } from '@/components/account/UsernameField'
import { BioField } from '@/components/account/BioField'
import { DisplayNameField } from '@/components/account/DisplayNameField'
import { PreferencesSection } from '@/components/account/PreferencesSection'
import { SecuritySection } from '@/components/account/SecuritySection'
import { DangerZone } from '@/components/account/DangerZone'
import { SettingsSection } from '@/components/account/SettingsSection'
import { formatMonthYear } from '@/lib/format'

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'recovery'

type SessionInfo = {
  email: string
  name: string | null
  since: string | null
  username: string | null
  avatarUrl: string | null
  creator: boolean
}

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
  // Which OAuth providers Supabase actually has switched on. The buttons used
  // to render unconditionally, so with only email enabled a visitor clicking
  // "Google" got a raw provider error — two dead buttons on the front door.
  // GoTrue's settings endpoint is public and answers in one round trip.
  const [oauthProviders, setOauthProviders] = useState<string[]>([])

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return
    let cancelled = false
    void fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((d: { external?: Record<string, boolean> }) => {
        if (cancelled || !d.external) return
        setOauthProviders(Object.entries(d.external).filter(([k, v]) => v && k !== 'email' && k !== 'phone').map(([k]) => k))
      })
      .catch(() => {
        /* endpoint unreachable — offer nothing rather than dead buttons */
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      // Signed in from a "you need an account" prompt somewhere else: go back
      // to whatever they were doing, rather than stranding them on Settings.
      if (event === 'SIGNED_IN') {
        const next = new URLSearchParams(window.location.search).get('next')
        // Same-origin paths only — an open redirect here would be a phishing
        // hop through a domain people are about to type a password into.
        if (next && next.startsWith('/') && !next.startsWith('//')) {
          window.location.replace(next)
          return
        }
      }
      void readUser()
    })
    return () => sub.subscription.unsubscribe()
     
  }, [supabase])

  if (!supabase) {
    return (
      <div className="ticket-card is-static max-w-[36rem] p-6">
        <p className="eyebrow m-0 text-flame">Not connected yet</p>
        <p className="mt-2 text-note leading-relaxed text-slate">
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
      // Both tracks capped: with a greedy 1fr the rail gets flung to the
      // shell's far edge, leaving a canyon between it and the card.
      <div className="grid gap-8 xl:grid-cols-[minmax(0,60rem)_minmax(0,20rem)] xl:items-start">
      <div className="ticket-card is-static p-6 sm:p-8">
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
              <p className="m-0 font-mono text-detail text-slate">@{session.username}</p>
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
                  setNotice({ kind: 'error', text: 'Avatar upload failed. Try a smaller image.' })
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
                {formatMonthYear(session.since)}
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
            <p className="m-0 text-eyebrow font-semibold text-ink">Cooking things worth sharing?</p>
            <p className="m-0 text-detail leading-snug text-slate">
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
            className="font-mono text-detail tracking-[0.12em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
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
          className="mt-6 w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-caption tracking-[0.12em] text-slate uppercase underline-offset-4 hover:text-heat hover:underline"
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
        'Couldn’t reach the sign-in service. Check the connection and try again.',
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
            text: 'Almost there. Confirm the link we just emailed you, then sign in.',
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
          text: 'Reset link sent. Check your inbox and follow it back here.',
        })
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMode('sign-in')
        setNotice({ kind: 'info', text: 'Password updated. You’re signed in.' })
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
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-detail tracking-[0.1em] text-slate uppercase hover:text-ink"
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
        className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-eyebrow text-ink focus:border-flame focus:outline-none"
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
              className={`font-mono text-caption ${strength.acceptable ? 'text-slate' : 'text-heat'}`}
            >
              {strength.label}
              {strength.suggestions[0] ? `. ${strength.suggestions[0]}` : ''}
            </span>
          </div>
        ) : (
          <span className="text-detail text-slate">At least 8 characters. Longer is stronger.</span>
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
              className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-eyebrow text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
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
              className="rounded border border-rule bg-transparent px-3 py-2 font-mono text-eyebrow text-ink focus:border-flame focus:outline-none"
            />
          </label>
        )}

        {mode !== 'forgot' && passwordField}

        {notice && (
          <p
            className={`m-0 text-eyebrow leading-snug ${
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
            className="w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-detail tracking-[0.1em] text-slate uppercase underline-offset-4 hover:underline"
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
            className="w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-detail tracking-[0.1em] text-slate uppercase underline-offset-4 hover:underline"
          >
            ← Back to sign in
          </button>
        )}
      </form>

      {mode !== 'recovery' && oauthProviders.length > 0 && (
        <div className="mt-6 border-t border-rule pt-5">
          <p className="eyebrow m-0">Or continue with</p>
          <div className="mt-2.5 flex gap-2">
            {oauthProviders.includes('google') && (
              <button type="button" onClick={() => void oauth('google')} className="chip">
                Google
              </button>
            )}
            {oauthProviders.includes('github') && (
              <button type="button" onClick={() => void oauth('github')} className="chip">
                GitHub
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
