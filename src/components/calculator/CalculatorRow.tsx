'use client'

import { Select } from '@/components/controls'
import { IngredientThumb, type ThumbImage } from '@/components/IngredientThumb'
import type { UnpricedReason } from '@/lib/cost'
import { unitPrice, useUnitsFor, type CostingItem } from '@/lib/costing'
import { formatMoney, minorPerMajor, parseMoneyInput } from '@/lib/money'

/**
 * One line of a costing: what you paid, what the dish uses, what that costs.
 *
 * Both facts are on the row, always. The version this replaces showed only an
 * amount and hid the price behind a link, which meant the total looked like it
 * arrived from nowhere — the single reason the first calculator read as dumb.
 * Everything here is a prop; the row does no fetching and knows nothing about
 * where a costing is stored.
 */

const UNIT_LABEL: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  tsp: 'tsp',
  tbsp: 'tbsp',
  cup: 'cup',
  piece: 'each',
  pack: 'packs',
  '': 'each',
}

const WHY: Record<UnpricedReason, string> = {
  'no-amount': 'Type how much the dish uses',
  'no-price': 'Say what you paid for this',
  'not-convertible': 'This amount cannot be converted to what you bought',
  'wrong-currency': 'Your price for this is in another currency',
}

export type RowProps = {
  item: CostingItem
  currency: string
  cost: number | null
  reason?: UnpricedReason
  image: ThumbImage
  category: string | null
  /** Our researched price, shown as a suggestion when the row has none. */
  suggestion: { priceMinor: number; packAmount: number; packUnit: string; label: string } | null
  /** Set once this row's price has been written to the price book. */
  remembered: boolean
  /** Why the price could not be saved, if it could not. */
  saveError?: string
  onChange: (patch: Partial<CostingItem>) => void
  onCommitPrice: () => void
  onUndoRemember: () => void
  onRemove: () => void
}

export function CalculatorRow({
  item,
  currency,
  cost,
  reason,
  image,
  category,
  suggestion,
  remembered,
  saveError,
  onChange,
  onCommitPrice,
  onUndoRemember,
  onRemove,
}: RowProps) {
  const units = useUnitsFor(item)
  const shelf = unitPrice(item)
  const major = minorPerMajor(currency)
  const decimals = major === 1 ? 0 : 2

  const priceText =
    item.priceMinor == null ? '' : (item.priceMinor / major).toFixed(decimals)

  return (
    <li className="border-b border-rule py-3.5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <IngredientThumb name={item.label} category={category} image={image} />

        <div className="min-w-[10rem] flex-1">
          <p className="m-0 truncate font-body text-[1rem] text-ink">{item.label}</p>

          {/* The two facts, spelled out as a sentence so the arithmetic reads
              rather than having to be inferred from a row of bare boxes. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-caption text-slate">
            <span>I paid</span>
            <input
              inputMode="decimal"
              value={priceText}
              onChange={(e) =>
                onChange({
                  priceMinor: parseMoneyInput(e.target.value, currency),
                  priceFrom: 'mine',
                })
              }
              onBlur={onCommitPrice}
              placeholder={currency}
              aria-label={`What you paid for ${item.label}`}
              className="w-20 rounded border border-rule bg-transparent px-2 py-1 text-right text-detail text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
            />
            <span>for</span>
            <input
              inputMode="decimal"
              value={item.packAmount ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value)
                onChange({ packAmount: Number.isFinite(n) && n > 0 ? n : null })
              }}
              onBlur={onCommitPrice}
              placeholder="500"
              aria-label={`How much you got for that, for ${item.label}`}
              className="w-16 rounded border border-rule bg-transparent px-2 py-1 text-right text-detail text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
            />
            <div className="w-[5.5rem] shrink-0">
              <Select
                value={item.packUnit ?? 'g'}
                onChange={(v) => {
                  const packUnit = v as CostingItem['packUnit']
                  // A free-text row may only use what it was bought in, so a
                  // changed pack unit has to drag the usage unit with it or the
                  // row silently becomes unpriceable.
                  onChange(item.slug ? { packUnit } : { packUnit, useUnit: packUnit })
                }}
                ariaLabel={`What you bought ${item.label} by`}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="piece">each</option>
              </Select>
            </div>
          </div>

          {/* The shelf figure: the only one comparable between a 90 g tub and a
              300 g one, and the reason someone can tell whether our estimate is
              anywhere near their shop. */}
          {shelf && (
            <p className="mt-1.5 mb-0 flex flex-wrap items-center gap-x-2 font-mono text-caption text-slate">
              <span>
                {formatMoney(Math.round(shelf.minor), currency)}
                {shelf.per === 'each' ? ' each' : `/${shelf.per}`}
              </span>
              {item.priceFrom === 'ours' && (
                <span className="rounded-sm border border-rule px-1.5 py-px text-slate/80">
                  our estimate
                </span>
              )}
              {item.priceFrom === 'mine' && (
                <span className="rounded-sm border border-flame/40 px-1.5 py-px text-flame">
                  what you pay
                </span>
              )}
            </p>
          )}

          {suggestion && item.priceMinor == null && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  priceFrom: 'ours',
                  priceMinor: suggestion.priceMinor,
                  packAmount: suggestion.packAmount,
                  packUnit: suggestion.packUnit as CostingItem['packUnit'],
                  useUnit: item.useUnit ?? (suggestion.packUnit === 'piece' ? '' : suggestion.packUnit),
                })
              }
              className="mt-1.5 cursor-pointer border-none bg-transparent p-0 text-left font-mono text-caption text-slate hover:text-flame"
            >
              ours: {formatMoney(suggestion.priceMinor, currency)} / {suggestion.packAmount}
              {UNIT_LABEL[suggestion.packUnit] ?? suggestion.packUnit}, tap to use
            </button>
          )}

          {saveError && (
            <p className="mt-1.5 mb-0 font-mono text-caption text-heat">
              could not save this price. {saveError}
            </p>
          )}

          {remembered && (
            <p className="mt-1.5 mb-0 font-mono text-caption text-slate">
              saved to your prices ·{' '}
              <button
                type="button"
                onClick={onUndoRemember}
                className="cursor-pointer border-none bg-transparent p-0 text-flame underline"
              >
                undo
              </button>
            </p>
          )}

          {!item.slug && (
            <p className="mt-1.5 mb-0 font-mono text-caption text-slate/70">
              typed in, not saved to your prices
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-caption text-slate">uses</span>
          <input
            inputMode="decimal"
            value={item.useAmount ?? ''}
            onChange={(e) => onChange({ useAmount: e.target.value })}
            placeholder="0"
            aria-label={`How much ${item.label} the dish uses`}
            className="w-16 rounded border border-rule bg-transparent px-2 py-1.5 text-right font-mono text-detail text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
          />

          <div className="w-[6.5rem] shrink-0">
            <Select
              value={item.useUnit ?? ''}
              onChange={(v) => onChange({ useUnit: v })}
              ariaLabel={`Unit for ${item.label}`}
            >
              {units.map((u) => (
                <option key={u || 'each'} value={u}>
                  {UNIT_LABEL[u] ?? u}
                </option>
              ))}
            </Select>
          </div>

          <span className="datum w-20 shrink-0 text-right">
            {cost != null ? (
              formatMoney(cost, currency)
            ) : (
              <span
                className="font-mono text-caption text-slate"
                title={reason ? WHY[reason] : 'Not priced'}
              >
                {reason === 'no-amount' ? '—' : '?'}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.label}`}
            className="shrink-0 cursor-pointer border-none bg-transparent p-1 text-slate hover:text-heat"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  )
}
