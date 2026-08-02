'use client'

import { type ReactNode } from 'react'

/**
 * The shell every account section renders into, and the chip that reports a
 * save. Shared by the fields beside them, so they live together.
 */

export function SettingsSection({
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
        {desc && <p className="mt-1.5 text-detail leading-snug text-slate lg:max-w-[22ch]">{desc}</p>}
      </div>
      <div className="grid min-w-0 content-start gap-4">{children}</div>
    </div>
  )
}

/** Shared look for a save chip that reports its own lifecycle. */

export function SaveChip({
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
