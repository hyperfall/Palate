'use client'

import { useRef } from 'react'

import { parseIngredientLine } from '@/lib/ingredients/parse'

export type IngredientRow = { quantity: string; unit: string; item: string }

export const emptyIngredientRow: IngredientRow = { quantity: '', unit: '', item: '' }

// Datalist hints only — the box accepts anything typed. Both abbreviations and
// spelled-out forms are listed so the filter matches whether the creator types
// "lb" or "pound". Mirrors the aliases the paste parser recognises.
const UNIT_SUGGESTIONS = [
  // volume
  'tsp', 'teaspoon', 'tbsp', 'tablespoon', 'cup', 'ml', 'milliliter', 'l', 'liter',
  'fl oz', 'pint', 'quart', 'gallon',
  // weight
  'g', 'gram', 'kg', 'kilogram', 'oz', 'ounce', 'lb', 'pound',
  // count / informal
  'clove', 'can', 'tin', 'jar', 'slice', 'sprig', 'stick', 'bunch', 'piece',
  'pinch', 'dash', 'handful', 'knob', 'splash', 'to taste',
]

/**
 * Structured ingredient rows: quantity · unit · name, so nothing has to be
 * guessed from a freeform line. Still as fast as a textarea — pasting a
 * multi-line list splits into rows and pre-fills each box (via the shared
 * ingredient parser); the creator then eyeballs and corrects.
 */
export function IngredientRowsInput({
  value,
  onChange,
}: {
  value: IngredientRow[]
  onChange: (next: IngredientRow[]) => void
}) {
  const itemRefs = useRef<Array<HTMLInputElement | null>>([])
  const focusItem = (i: number) => requestAnimationFrame(() => itemRefs.current[i]?.focus())

  const setAt = (i: number, patch: Partial<IngredientRow>) => {
    const next = [...value]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const addRow = (at: number) => {
    const next = [...value]
    next.splice(at, 0, { ...emptyIngredientRow })
    onChange(next)
    focusItem(at)
  }

  const removeRow = (i: number) => {
    if (value.length <= 1) {
      onChange([{ ...emptyIngredientRow }])
      return
    }
    onChange(value.filter((_, idx) => idx !== i))
    focusItem(Math.max(0, i - 1))
  }

  const rowIsEmpty = (r: IngredientRow) => !r.quantity && !r.unit && !r.item

  // Enter in the quantity/unit cells would otherwise implicitly submit the whole
  // form (they're bare inputs); instead advance to the item field of the row, so
  // Enter always means "move along this row" rather than "submit mid-entry".
  const onCellEnter = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      focusItem(i)
    }
  }

  const onItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addRow(i + 1)
    } else if (e.key === 'Backspace' && rowIsEmpty(value[i]) && value.length > 1) {
      e.preventDefault()
      removeRow(i)
    }
  }

  const toRow = (line: string): IngredientRow => {
    const p = parseIngredientLine(line)
    return { quantity: p.quantity ?? '', unit: p.unit ?? '', item: p.item }
  }

  const onItemPaste = (e: React.ClipboardEvent<HTMLInputElement>, i: number) => {
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    // A single-line paste into an empty item still gets parsed (splits qty/unit out).
    if (lines.length <= 1) {
      if (lines.length === 1 && value[i].item === '') {
        e.preventDefault()
        setAt(i, toRow(lines[0]))
      }
      return
    }
    e.preventDefault()
    const parsed = lines.map(toRow)
    const next = [...value]
    next.splice(i, rowIsEmpty(value[i]) ? 1 : 0, ...parsed)
    onChange(next)
    focusItem(i + parsed.length - 1)
  }

  const cellCls =
    'min-w-0 rounded border border-rule bg-transparent px-3 py-2 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none'

  return (
    <div role="group" aria-label="Ingredients" className="grid grid-cols-1 gap-2">
      <datalist id="ingredient-units">
        {UNIT_SUGGESTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            maxLength={12}
            value={row.quantity}
            aria-label={`Quantity ${i + 1}`}
            placeholder="1"
            onChange={(e) => setAt(i, { quantity: e.target.value })}
            onKeyDown={(e) => onCellEnter(e, i)}
            className={`${cellCls} w-14 shrink-0 text-center tabular-nums`}
          />
          <input
            type="text"
            list="ingredient-units"
            maxLength={24}
            value={row.unit}
            aria-label={`Unit ${i + 1}`}
            placeholder="unit"
            onChange={(e) => setAt(i, { unit: e.target.value })}
            onKeyDown={(e) => onCellEnter(e, i)}
            className={`${cellCls} w-20 shrink-0 sm:w-24`}
          />
          <input
            ref={(el) => {
              itemRefs.current[i] = el
            }}
            type="text"
            maxLength={120}
            value={row.item}
            aria-label={`Ingredient ${i + 1}`}
            placeholder="ingredient"
            onChange={(e) => setAt(i, { item: e.target.value })}
            onKeyDown={(e) => onItemKeyDown(e, i)}
            onPaste={(e) => onItemPaste(e, i)}
            className={`${cellCls} flex-1`}
          />
          <button
            type="button"
            aria-label={`Remove ingredient ${i + 1}`}
            onClick={() => removeRow(i)}
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded border border-rule bg-transparent font-mono text-slate transition-colors hover:border-heat hover:text-heat"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addRow(value.length)}
        className="w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-[0.75rem] font-medium tracking-[0.1em] text-flame uppercase underline-offset-4 hover:underline"
      >
        + Add ingredient
      </button>
    </div>
  )
}
