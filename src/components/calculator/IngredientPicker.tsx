'use client'

import { useMemo, useRef, useState } from 'react'

import { IngredientThumb, type ThumbImage } from '@/components/IngredientThumb'
import { foldText } from '@/lib/fuzzy'

/**
 * Search the catalogue, or add whatever you typed.
 *
 * The free-text option is what stops the calculator being a demo. The catalogue
 * is 109 ingredients — enough for the site's own recipes and nobody else's — so
 * without a way to add chorizo or oat milk, most real cooking cannot be costed
 * at all. A catalogue row gets unit conversion and a suggested price; a typed
 * row gets neither, and says so.
 */

export type PickerOption = {
  slug: string
  name: string
  category: string | null
  image: ThumbImage
  hasPrice: boolean
}

export function IngredientPicker({
  options,
  taken,
  onPick,
  onFreeText,
  disabled,
}: {
  options: PickerOption[]
  taken: Set<string>
  onPick: (slug: string) => void
  onFreeText: (label: string) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const q = foldText(query)
    if (!q) return []
    return options.filter((o) => !taken.has(o.slug) && foldText(o.name).includes(q)).slice(0, 7)
  }, [query, options, taken])

  const trimmed = query.trim()
  // Only offer to add freehand when nothing in the catalogue is an exact match,
  // or the list would invite two rows for the same thing.
  const exact = matches.some((m) => foldText(m.name) === foldText(trimmed))
  const canAddFree = trimmed.length > 1 && !exact

  function pick(slug: string) {
    onPick(slug)
    setQuery('')
    inputRef.current?.focus()
  }

  function addFree() {
    onFreeText(trimmed)
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Add an ingredient</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (matches[0]) pick(matches[0].slug)
            else if (canAddFree) addFree()
          }}
          placeholder="tofu, olive oil, chorizo…"
          aria-label="Search the ingredient catalogue"
          className="w-full rounded border border-rule bg-transparent px-3 py-2.5 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none disabled:opacity-50"
        />
      </label>

      {(matches.length > 0 || canAddFree) && (
        <ul className="absolute top-full left-0 z-30 mt-1.5 w-full list-none overflow-hidden rounded-md border border-ink/25 bg-card p-1.5 shadow-(--shadow-block)">
          {matches.map((m) => (
            <li key={m.slug} className="m-0">
              <button
                type="button"
                onClick={() => pick(m.slug)}
                className="flex w-full cursor-pointer items-center gap-3 rounded p-2 text-left hover:bg-wash"
              >
                <IngredientThumb name={m.name} category={m.category} image={m.image} size={30} />
                <span className="font-body text-[0.95rem] text-ink">{m.name}</span>
                {!m.hasPrice && (
                  <span className="ml-auto font-mono text-caption text-slate">no price yet</span>
                )}
              </button>
            </li>
          ))}
          {canAddFree && (
            <li className="m-0">
              <button
                type="button"
                onClick={addFree}
                className="flex w-full cursor-pointer items-center gap-3 rounded p-2 text-left hover:bg-wash"
              >
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded border border-dashed border-rule font-mono text-caption text-slate">
                  +
                </span>
                <span className="font-body text-[0.95rem] text-ink">
                  Add “{trimmed}” — you give it a price
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
