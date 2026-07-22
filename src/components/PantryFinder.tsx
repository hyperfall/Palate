'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Select } from './controls'

/**
 * The pantry control. Chips are the state that matters — everything else
 * (autocomplete, time cap) just adds or narrows them. State lives in the URL
 * (`?have=slug,slug&time=45`) so the results page can render server-side and
 * a reload restores exactly what was there; a copy of the pantry mirrors to
 * `localStorage` so a bare `/cook-from` visit can offer it back.
 */

type Ingredient = { slug: string; name: string }

const STORAGE_KEY = 'palate:pantry'

const TIME_OPTIONS: Array<{ value: string; label: string; minutes: number | null }> = [
  { value: 'any', label: 'Any time', minutes: null },
  { value: '15', label: 'Under 15 min', minutes: 15 },
  { value: '30', label: 'Under 30 min', minutes: 30 },
  { value: '45', label: 'Under 45 min', minutes: 45 },
  { value: '60', label: 'Under 1 hour', minutes: 60 },
]

function readStoredPantry(): Ingredient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    const have = (parsed as { have?: unknown } | null)?.have
    if (!Array.isArray(have)) return []
    return have.filter(
      (item): item is Ingredient =>
        Boolean(item) && typeof item.slug === 'string' && typeof item.name === 'string',
    )
  } catch {
    return []
  }
}

function writeStoredPantry(have: Ingredient[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ have }))
  } catch {
    // Private browsing / quota — the URL is still the source of truth.
  }
}

export function PantryFinder({
  initialHave,
  initialTime,
}: {
  initialHave: Ingredient[]
  initialTime: number | null
}) {
  const router = useRouter()
  const [have, setHave] = useState<Ingredient[]>(initialHave)
  const [time, setTime] = useState<number | null>(initialTime)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Ingredient[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [restoreOffer, setRestoreOffer] = useState<Ingredient[] | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const commit = (nextHave: Ingredient[], nextTime: number | null) => {
    writeStoredPantry(nextHave)
    const params = new URLSearchParams()
    if (nextHave.length > 0) params.set('have', nextHave.map((h) => h.slug).join(','))
    if (nextTime) params.set('time', String(nextTime))
    router.push(`/cook-from${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
  }

  // Offer the last pantry back when arriving with an empty one — a bare
  // visit (or a cleared URL) shouldn't force retyping the whole list.
  useEffect(() => {
    if (initialHave.length > 0) return
    const stored = readStoredPantry()
    if (stored.length > 0) setRestoreOffer(stored)
    // Only on mount: initialHave/initialTime are the page's own read of the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restore = () => {
    if (!restoreOffer) return
    setHave(restoreOffer)
    commit(restoreOffer, time)
    setRestoreOffer(null)
  }

  // Debounced autocomplete against the suggest endpoint.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const t = setTimeout(() => {
      fetch(`/cook-from/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: { suggestions?: Ingredient[] } | null) => {
          if (payload) {
            const haveSlugs = new Set(have.map((h) => h.slug))
            setSuggestions((payload.suggestions ?? []).filter((s) => !haveSlugs.has(s.slug)))
            setDropdownOpen(true)
          }
        })
        .catch(() => {})
    }, 200)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [query, have])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const addIngredient = (ingredient: Ingredient) => {
    if (have.some((h) => h.slug === ingredient.slug)) return
    const next = [...have, ingredient]
    setHave(next)
    setQuery('')
    setSuggestions([])
    setDropdownOpen(false)
    commit(next, time)
  }

  const removeIngredient = (slug: string) => {
    const next = have.filter((h) => h.slug !== slug)
    setHave(next)
    commit(next, time)
  }

  const onTimeChange = (value: string) => {
    const option = TIME_OPTIONS.find((o) => o.value === value) ?? TIME_OPTIONS[0]
    setTime(option.minutes)
    commit(have, option.minutes)
  }

  return (
    <div ref={rootRef} className="grid gap-4">
      {restoreOffer && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-rule bg-card px-4 py-3">
          <p className="m-0 flex-1 text-[0.8125rem] text-slate">
            Restore your last pantry ({restoreOffer.length} item{restoreOffer.length === 1 ? '' : 's'})?
          </p>
          <button
            type="button"
            onClick={restore}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] font-medium tracking-[0.1em] text-flame uppercase underline-offset-2 hover:underline"
          >
            Restore
          </button>
          <button
            type="button"
            onClick={() => setRestoreOffer(null)}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] font-medium tracking-[0.1em] text-slate uppercase underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-0 flex-1">
          <label className="block">
            <span className="eyebrow m-0">Add an ingredient</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setDropdownOpen(true)}
              placeholder="e.g. chicken thigh"
              className="mt-1.5 w-full rounded border border-rule bg-transparent px-3.5 py-2.5 font-mono text-[0.8125rem] text-ink placeholder:text-slate focus:border-flame focus:outline-none"
            />
          </label>

          {dropdownOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Ingredient suggestions"
              className="scroll-rail absolute top-full left-0 z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-ink/30 bg-card p-1.5 text-ink shadow-(--shadow-block)"
            >
              {suggestions.map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      addIngredient(s)
                    }}
                    className="w-full cursor-pointer rounded p-2 text-left font-mono text-[0.8125rem] text-ink hover:bg-wash"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block">
          <span className="eyebrow m-0">Time</span>
          <div className="mt-1.5 min-w-[9.5rem]">
            <Select
              value={time ? String(time) : 'any'}
              onChange={onTimeChange}
              ariaLabel="Maximum cook time"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </label>
      </div>

      {have.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {have.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => removeIngredient(item.slug)}
              className="chip"
              aria-label={`Remove ${item.name}`}
            >
              {item.name} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
