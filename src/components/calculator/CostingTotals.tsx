'use client'

import Link from 'next/link'

import { Select } from '@/components/controls'
import type { CostResult } from '@/lib/cost'
import { BASE_CURRENCY, formatMoney, supportedCurrencies } from '@/lib/money'
import type { SaveState } from '@/lib/useCosting'

/**
 * What the dish comes to, and the two settings that change it.
 *
 * The per-plate figure is the one people came for, so it carries the accent.
 * The panel is also where a partial answer has to admit it is partial: a total
 * built from four of eleven ingredients looks identical to a complete one
 * unless it says so, and that is the failure the whole cost feature exists to
 * avoid.
 */
export function CostingTotals({
  result,
  servings,
  currency,
  saveState,
  signedIn,
  onServings,
  onCurrency,
}: {
  result: CostResult
  servings: number
  currency: string
  saveState: SaveState
  signedIn: boolean
  onServings: (n: number) => void
  onCurrency: (c: string) => void
}) {
  const missing = result.quantified - result.priced

  return (
    <aside className="rounded border border-rule bg-wash p-5 lg:sticky lg:top-24">
      <p className="eyebrow m-0">What it comes to</p>

      <dl className="mt-4 grid gap-2">
        <div className="leader">
          <dt className="eyebrow font-semibold text-ink">Total</dt>
          <span className="leader__dots" aria-hidden="true" />
          <dd className="datum m-0 font-semibold">
            {formatMoney(result.totalMinor, result.currency)}
          </dd>
        </div>
        <div className="leader">
          <dt className="eyebrow">A plate</dt>
          <span className="leader__dots" aria-hidden="true" />
          <dd className="datum m-0 text-flame">
            {formatMoney(result.perServingMinor, result.currency)}
          </dd>
        </div>
      </dl>

      <label className="mt-5 flex items-center justify-between gap-3 border-t border-rule pt-4">
        <span className="eyebrow">Serves</span>
        <input
          type="number"
          min={1}
          max={100}
          value={servings}
          onChange={(e) => onServings(Number(e.target.value))}
          className="w-20 rounded border border-rule bg-transparent px-2 py-1.5 text-right font-mono text-detail text-ink focus:border-flame focus:outline-none"
        />
      </label>

      <label className="mt-3 flex items-center justify-between gap-3">
        <span className="eyebrow">Currency</span>
        <div className="w-28 shrink-0">
          <Select value={currency} onChange={onCurrency} ariaLabel="Currency">
            {supportedCurrencies().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </label>

      {missing > 0 && (
        <p className="mt-4 mb-0 text-eyebrow leading-snug text-slate">
          {missing} of {result.quantified} still without a price, so this is short of the real
          total.
        </p>
      )}

      {currency !== BASE_CURRENCY && (
        <p className="mt-3 mb-0 text-eyebrow leading-snug text-slate">
          Our estimates are in {BASE_CURRENCY} and are never converted — a rate we invented would be
          worse than a gap. In {currency}, only prices you enter count.
        </p>
      )}

      <p className="mt-4 mb-0 text-eyebrow leading-snug text-slate" aria-live="polite">
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved.'}
        {saveState === 'error' && 'Could not save — your work is still here, try again in a moment.'}
        {(saveState === 'signed-out' || (!signedIn && saveState === 'idle')) && (
          <>
            <Link href="/account" className="text-flame">
              Sign in
            </Link>{' '}
            to name and keep this, and to have the prices you correct follow you onto every recipe.
          </>
        )}
      </p>
    </aside>
  )
}
