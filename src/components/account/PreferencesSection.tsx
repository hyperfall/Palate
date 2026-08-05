'use client'

import Link from 'next/link'

import { ThemeToggle } from '@/components/ThemeToggle'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useUnitSystem } from '@/lib/useUnitSystem'
import { SettingsSection } from '@/components/account/SettingsSection'

export function PreferencesSection() {
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
      desc="How recipes read to you, here and on your other devices."
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <span className="font-mono text-tag tracking-[0.08em] text-slate uppercase">Measures</span>
        <div className="flex gap-2">
          <button type="button" className="chip" data-active={units === 'metric'} onClick={() => pick('metric')}>
            Metric
          </button>
          <button type="button" className="chip" data-active={units === 'us'} onClick={() => pick('us')}>
            US cups
          </button>
        </div>
        <span className="text-detail text-slate">Applies to every recipe, on this and future devices.</span>
      </div>
      <div className="grid gap-1.5">
        <span className="font-mono text-tag tracking-[0.08em] text-slate uppercase">Theme</span>
        <ThemeToggle colorClass="border-rule text-ink" />
      </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link
          href="/taste"
          className="font-mono text-detail tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
        >
          Retake the taste quiz →
        </Link>
        <Link
          href="/cook-from"
          className="font-mono text-detail tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
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
