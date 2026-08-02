'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { parseIngredientLine } from '@/lib/ingredients/parse'
import { foldIngredientRows, mergePastedRow } from '@/lib/ingredients/rows'

export type IngredientRow = { quantity: string; unit: string; item: string }

export const emptyIngredientRow: IngredientRow = { quantity: '', unit: '', item: '' }

/**
 * The canonical units the platform actually understands — every one of these is
 * a unit the paste parser normalises AND the nutrition engine can turn into
 * grams. Metric-first, because the site is. Grouped so the picker can show a
 * heading; the creator can still type a free-form unit, but the list steers them
 * onto the vocabulary the whole structured backbone is built on.
 */
const UNIT_GROUPS: Array<{ label: string; units: string[] }> = [
  { label: 'Weight', units: ['g', 'kg', 'oz', 'lb'] },
  { label: 'Volume', units: ['ml', 'l', 'tsp', 'tbsp', 'cup'] },
  { label: 'Count', units: ['clove', 'slice', 'sprig', 'stick', 'bunch', 'can', 'tin', 'jar'] },
  { label: 'Informal', units: ['pinch', 'dash', 'handful', 'knob', 'splash'] },
]
export const CANONICAL_UNITS = UNIT_GROUPS.flatMap((g) => g.units)

/** Substring filter over the canonical units; empty query returns them all. */
export function filterUnits(query: string): string[] {
  const q = query.trim().toLowerCase()
  return q ? CANONICAL_UNITS.filter((u) => u.includes(q)) : CANONICAL_UNITS
}

/**
 * A small on-brand unit combobox: styled like the rest of the form, filters the
 * canonical list as you type, arrow-key + click selectable, and still accepts a
 * free-form unit. Picking one advances the cursor to the ingredient name.
 */
function UnitCombobox({
  value,
  index,
  cellCls,
  onChange,
  onAdvance,
}: {
  value: string
  index: number
  cellCls: string
  onChange: (v: string) => void
  onAdvance: () => void
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearBlurTimer = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current)
      blurTimer.current = null
    }
  }
  // A pending blur-close must not fire into an unmounted row (remove/paste-split)
  // or force-close a dropdown that was refocused within the 120ms window.
  useEffect(() => clearBlurTimer, [])

  const options = useMemo(() => filterUnits(value), [value])

  const choose = (u: string) => {
    onChange(u)
    setOpen(false)
    setHi(-1)
    onAdvance()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHi((h) => Math.min(h + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && hi >= 0 && options[hi]) choose(options[hi])
      else onAdvance()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHi(-1)
    }
  }

  return (
    <div className="relative w-20 shrink-0 sm:w-24">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open && options.length > 0 ? `units-${index}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={24}
        value={value}
        aria-label={`Unit ${index + 1}`}
        placeholder="unit"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHi(-1)
        }}
        onFocus={() => {
          clearBlurTimer()
          setOpen(true)
        }}
        onBlur={() => {
          clearBlurTimer()
          blurTimer.current = setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={onKeyDown}
        className={`${cellCls} w-full`}
      />
      {open && options.length > 0 && (
        <ul
          id={`units-${index}`}
          role="listbox"
          // Keep input focus so the blur-close doesn't fire before the click.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 z-30 mt-1 max-h-56 w-28 overflow-auto rounded border border-rule bg-paper py-1 shadow-block"
        >
          {options.map((u, oi) => (
            <li key={u}>
              <button
                type="button"
                role="option"
                aria-selected={oi === hi}
                onMouseEnter={() => setHi(oi)}
                onClick={() => choose(u)}
                className={`block w-full px-3 py-1 text-left font-mono text-detail transition-colors ${
                  oi === hi ? 'bg-flame/10 text-flame' : 'text-ink hover:bg-wash'
                }`}
              >
                {u}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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
    // A single-line paste still gets parsed (splits qty/unit out) — but it only
    // fills what it actually carries. Pasting a bare name into a row where the
    // quantity and unit are already typed must not wipe them.
    if (lines.length <= 1) {
      if (lines.length === 1 && !value[i].item.trim()) {
        e.preventDefault()
        setAt(i, mergePastedRow(value[i], toRow(lines[0])))
      }
      return
    }
    e.preventDefault()
    // Fold qualifier lines into the ingredient above them as the rows appear,
    // so what the creator reviews is what gets stored.
    const parsed = foldIngredientRows(lines.map(toRow))
    const cur = value[i]
    const next = [...value]
    if (rowIsEmpty(cur)) {
      // Nothing typed here — the list simply lands.
      next.splice(i, 1, ...parsed)
    } else if (!cur.item.trim()) {
      // Measure typed, name pasted: the first line joins this row, the rest follow.
      next.splice(i, 1, mergePastedRow(cur, parsed[0]), ...parsed.slice(1))
    } else {
      next.splice(i, 0, ...parsed)
    }
    onChange(next)
    focusItem(i + parsed.length - 1)
  }

  const cellCls =
    'min-w-0 rounded border border-rule bg-transparent px-3 py-2 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none'

  return (
    <div role="group" aria-label="Ingredients" className="grid grid-cols-1 gap-2">
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
          <UnitCombobox
            value={row.unit}
            index={i}
            cellCls={cellCls}
            onChange={(v) => setAt(i, { unit: v })}
            onAdvance={() => focusItem(i)}
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
        className="w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-caption font-medium tracking-[0.1em] text-flame uppercase underline-offset-4 hover:underline"
      >
        + Add ingredient
      </button>
    </div>
  )
}
