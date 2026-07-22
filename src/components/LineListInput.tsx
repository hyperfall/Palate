'use client'

import { useRef } from 'react'

/**
 * A growing list of single-line inputs — structured like recipe rows, but as
 * fast as a textarea: Enter adds the next row, Backspace on an empty row
 * removes it, and pasting multi-line text splits across rows automatically.
 * So a creator can dump their whole ingredient list at once and still get
 * clean, numbered, removable rows.
 */
export function LineListInput({
  value,
  onChange,
  numbered = false,
  placeholder,
  addLabel,
  ariaLabel,
}: {
  value: string[]
  onChange: (next: string[]) => void
  numbered?: boolean
  placeholder?: (index: number) => string
  addLabel: string
  ariaLabel: string
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const focusRow = (i: number) =>
    requestAnimationFrame(() => refs.current[i]?.focus())

  const setAt = (i: number, v: string) => {
    const next = [...value]
    next[i] = v
    onChange(next)
  }

  const addRow = (at: number) => {
    const next = [...value]
    next.splice(at, 0, '')
    onChange(next)
    focusRow(at)
  }

  const removeRow = (i: number) => {
    if (value.length <= 1) {
      onChange([''])
      return
    }
    onChange(value.filter((_, idx) => idx !== i))
    focusRow(Math.max(0, i - 1))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addRow(i + 1)
    } else if (e.key === 'Backspace' && value[i] === '' && value.length > 1) {
      e.preventDefault()
      removeRow(i)
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, i: number) => {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n')) return // single line — let the browser handle it
    e.preventDefault()
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    const next = [...value]
    // Merge the first pasted line into the current row: append after any
    // existing text with a space (never weld two words together), or just take
    // the pasted line when the row is empty — the common paste-into-blank case.
    const existing = value[i].trim()
    const head = existing ? `${existing} ${lines[0]}` : lines[0]
    next.splice(i, 1, head, ...lines.slice(1))
    onChange(next)
    focusRow(i + lines.length - 1)
  }

  return (
    <div role="group" aria-label={ariaLabel} className="grid gap-2">
      {value.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          {numbered && (
            <span
              aria-hidden="true"
              className="w-6 shrink-0 text-right font-mono text-[0.8125rem] font-semibold text-flame tabular-nums"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
          )}
          <input
            ref={(el) => {
              refs.current[i] = el
            }}
            type="text"
            value={line}
            aria-label={`${ariaLabel} ${i + 1}`}
            placeholder={placeholder?.(i)}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={(e) => onPaste(e, i)}
            className="min-w-0 flex-1 rounded border border-rule bg-transparent px-3 py-2 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
          />
          <button
            type="button"
            aria-label={`Remove ${ariaLabel} ${i + 1}`}
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
        + {addLabel}
      </button>
    </div>
  )
}
