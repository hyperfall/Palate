'use client'

import Link from 'next/link'

import { Select } from '@/components/controls'
import type { CostResult } from '@/lib/cost'
import { BASE_CURRENCY, formatMoney, supportedCurrencies } from '@/lib/money'
import { biggestLeftovers, type ShoppingResult } from '@/lib/shopping'
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
  shopping,
  servings,
  currency,
  saveState,
  signedIn,
  onServings,
  onCurrency,
}: {
  result: CostResult
  shopping: ShoppingResult
  servings: number
  currency: string
  saveState: SaveState
  signedIn: boolean
  onServings: (n: number) => void
  onCurrency: (c: string) => void
}) {
  const missing = result.quantified - result.priced
  // Only worth showing when the two readings actually differ. When every pack
  // is used up, "you'd buy" and "the dish" are the same number and the section
  // is noise.
  const showTill = !shopping.empty && shopping.leftoverMinor > 0
  const worst = showTill ? biggestLeftovers(shopping, 2) : []

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

      {showTill && (
        <div className="mt-5 border-t border-rule pt-4">
          <p className="eyebrow m-0">At the till</p>
          <p className="mt-1 mb-0 text-eyebrow leading-snug text-slate">
            Cooking this once from an empty cupboard.
          </p>

          <dl className="mt-3 grid gap-2">
            <div className="leader">
              <dt className="eyebrow">You&rsquo;d buy</dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0 font-semibold">
                {formatMoney(shopping.shoppingMinor, shopping.currency)}
              </dd>
            </div>
            <div className="leader">
              <dt className="eyebrow">Left over</dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0">
                {formatMoney(shopping.leftoverMinor, shopping.currency)}
              </dd>
            </div>
            <div className="leader">
              {/* The number that makes stocking a cupboard feel worth it. */}
              <dt className="eyebrow">Next time</dt>
              <span className="leader__dots" aria-hidden="true" />
              <dd className="datum m-0">
                {formatMoney(shopping.secondTimeMinor, shopping.currency)}
              </dd>
            </div>
          </dl>

          {worst.length > 0 && (
            <p className="mt-3 mb-0 text-eyebrow leading-snug text-slate">
              Most of what stays in the cupboard is{' '}
              {worst.map((l, i) => (
                <span key={l.item}>
                  {i > 0 && ' and '}
                  <span className="text-ink">{l.item}</span> (
                  {formatMoney(l.leftoverMinor, shopping.currency)})
                </span>
              ))}
              .
            </p>
          )}
        </div>
      )}

      {missing > 0 && (
        <p className="mt-4 mb-0 text-eyebrow leading-snug text-slate">
          {missing} of {result.quantified} still without a price, so this is short of the real
          total.
        </p>
      )}

      {currency !== BASE_CURRENCY && (
        <div className="mt-4 rounded border border-rule bg-paper/40 px-3 py-2.5">
          <p className="m-0 text-eyebrow leading-snug text-slate">
            Our shelf prices are British, and we never convert them — a rate we invented would be
            worse than a gap. In {currency}, only prices you enter count
            {result.quantified > 0 && result.priced === 0 ? ', which is why this is empty' : ''}.
          </p>
          {/* Without this a cook outside the UK meets a calculator that cannot
              help them and no way out of it: every row unpriced, the total zero,
              and the reason buried in a paragraph. */}
          <button
            type="button"
            onClick={() => onCurrency(BASE_CURRENCY)}
            className="tap mt-2 cursor-pointer border-none bg-transparent p-0 font-mono text-caption text-flame underline"
          >
            Work in {BASE_CURRENCY} to use them
          </button>
        </div>
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
