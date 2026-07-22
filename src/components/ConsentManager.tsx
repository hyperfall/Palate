'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  CATEGORIES,
  CATEGORY_COOKIE_PREFIXES,
  clearCookiesByPrefix,
  DENIED,
  hasGPC,
  makeConsent,
  readConsentCookie,
  writeConsentCookie,
  type ConsentCategory,
  type ConsentState,
} from '@/lib/consent'

type ConsentContextValue = {
  consent: ConsentState | null
  decided: boolean
  gpc: boolean
  openPreferences: () => void
  acceptAll: () => void
  rejectAll: () => void
  save: (choices: Partial<Record<ConsentCategory, boolean>>) => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent must be used within <ConsentProvider>')
  return ctx
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null)
  const [decided, setDecided] = useState(true) // avoid a banner flash before mount
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [gpc, setGpc] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setGpc(hasGPC())
    const existing = readConsentCookie()
    if (existing) {
      setConsent(existing)
      setDecided(true)
    } else {
      setDecided(false)
    }
  }, [])

  const apply = useCallback((next: ConsentState) => {
    // Actively clear a category's cookies the moment it's withdrawn.
    for (const cat of ['analytics', 'marketing', 'preferences'] as ConsentCategory[]) {
      if (!next[cat]) clearCookiesByPrefix(CATEGORY_COOKIE_PREFIXES[cat])
    }
    writeConsentCookie(next)
    setConsent(next)
    setDecided(true)
    setPrefsOpen(false)
  }, [])

  const acceptAll = useCallback(
    () => apply(makeConsent({ analytics: true, marketing: true, preferences: true })),
    [apply],
  )
  const rejectAll = useCallback(() => apply(makeConsent(DENIED)), [apply])
  const save = useCallback(
    (choices: Partial<Record<ConsentCategory, boolean>>) => apply(makeConsent(choices)),
    [apply],
  )
  const openPreferences = useCallback(() => setPrefsOpen(true), [])

  return (
    <ConsentContext.Provider
      value={{ consent, decided, gpc, openPreferences, acceptAll, rejectAll, save }}
    >
      {children}
      {mounted && !decided && !prefsOpen && (
        <CookieBanner
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onCustomize={openPreferences}
        />
      )}
      {mounted && prefsOpen && (
        <CookiePreferences
          existing={consent}
          gpc={gpc}
          canClose={decided}
          onClose={() => setPrefsOpen(false)}
          onSave={save}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
        />
      )}
    </ConsentContext.Provider>
  )
}

/** Footer entry point — reopen the settings anytime (required for withdrawal). */
export function CookieSettingsButton({
  className,
  children,
}: {
  className?: string
  children?: ReactNode
}) {
  const { openPreferences } = useConsent()
  return (
    <button type="button" onClick={openPreferences} className={className}>
      {children ?? 'Cookie settings'}
    </button>
  )
}

function CookieBanner({
  onAcceptAll,
  onRejectAll,
  onCustomize,
}: {
  onAcceptAll: () => void
  onRejectAll: () => void
  onCustomize: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-rule bg-paper/98 backdrop-blur-sm"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
    >
      <div className="shell flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="max-w-[62ch]">
          <p className="eyebrow m-0 text-flame">Cookies</p>
          <p className="mt-1 text-[0.9375rem] leading-snug text-slate">
            We use strictly-necessary cookies to run the site (sign-in, your choices). With your
            consent we also use analytics — and, if you allow it, marketing — cookies. You can accept,
            reject, or choose per category. Change it anytime under “Cookie settings.”
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 lg:flex-nowrap">
          <button
            type="button"
            onClick={onCustomize}
            className="rounded border border-rule px-4 py-2.5 font-mono text-[0.8125rem] font-medium tracking-[0.08em] text-ink uppercase transition-colors hover:border-ink"
          >
            Customize
          </button>
          <button
            type="button"
            onClick={onRejectAll}
            className="rounded border border-rule px-4 py-2.5 font-mono text-[0.8125rem] font-medium tracking-[0.08em] text-ink uppercase transition-colors hover:border-ink"
          >
            Reject all
          </button>
          <button type="button" onClick={onAcceptAll} className="btn-primary">
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? 'bg-flame' : 'bg-rule'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-paper shadow transition-transform ${
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function CookiePreferences({
  existing,
  gpc,
  canClose,
  onClose,
  onSave,
  onAcceptAll,
  onRejectAll,
}: {
  existing: ConsentState | null
  gpc: boolean
  canClose: boolean
  onClose: () => void
  onSave: (choices: Partial<Record<ConsentCategory, boolean>>) => void
  onAcceptAll: () => void
  onRejectAll: () => void
}) {
  // Seed from an existing decision; otherwise everything off (GPC also forces off).
  const [choices, setChoices] = useState<Record<ConsentCategory, boolean>>({
    analytics: existing?.analytics ?? false,
    marketing: gpc ? false : (existing?.marketing ?? false),
    preferences: existing?.preferences ?? false,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && canClose && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [canClose, onClose])

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center">
      <button
        type="button"
        aria-label="Close cookie settings"
        onClick={() => canClose && onClose()}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cookie settings"
        className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-rule bg-paper p-6 text-ink sm:max-w-[40rem] sm:rounded-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow m-0 text-flame">Cookie settings</p>
            <h2 className="mt-1 text-[1.5rem]">Choose what we may store</h2>
          </div>
          {canClose && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-rule text-slate hover:text-ink"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>

        {gpc && (
          <p className="mt-4 rounded border border-rule bg-wash px-3 py-2 text-[0.8125rem] text-slate">
            We detected a Global Privacy Control signal, so marketing is off by default. You can still
            change any setting below.
          </p>
        )}

        <ul className="mt-5 list-none space-y-4 p-0">
          <li className="flex items-start justify-between gap-4 border-t border-rule pt-4">
            <div>
              <p className="m-0 font-body font-semibold text-ink">Strictly necessary</p>
              <p className="mt-1 text-[0.875rem] leading-snug text-slate">
                Required to run the site — sign-in, security, and remembering this consent choice.
                Always on.
              </p>
            </div>
            <span className="mt-1 font-mono text-[0.75rem] tracking-[0.08em] text-slate uppercase">
              Always on
            </span>
          </li>

          {CATEGORIES.map((cat) => (
            <li
              key={cat.key}
              className="flex items-start justify-between gap-4 border-t border-rule pt-4"
            >
              <div>
                <p className="m-0 font-body font-semibold text-ink">{cat.label}</p>
                <p className="mt-1 text-[0.875rem] leading-snug text-slate">{cat.description}</p>
              </div>
              <div className="mt-1">
                <Toggle
                  label={`Allow ${cat.label} cookies`}
                  checked={choices[cat.key]}
                  onChange={(v) => setChoices((c) => ({ ...c, [cat.key]: v }))}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-rule pt-5">
          <button type="button" onClick={() => onSave(choices)} className="btn-primary">
            Save choices
          </button>
          <button
            type="button"
            onClick={onRejectAll}
            className="rounded border border-rule px-4 py-2.5 font-mono text-[0.8125rem] font-medium tracking-[0.08em] text-ink uppercase transition-colors hover:border-ink"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="rounded border border-rule px-4 py-2.5 font-mono text-[0.8125rem] font-medium tracking-[0.08em] text-ink uppercase transition-colors hover:border-ink"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
