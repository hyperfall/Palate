'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Select } from '@/components/controls'
import { supabaseBrowser } from '@/lib/supabase/client'

type Ingredient = { slug: string; name: string }

const TIME_OPTIONS = [
  { label: 'Any time', value: '' },
  { label: '≤ 15 min', value: '15' },
  { label: '≤ 30 min', value: '30' },
  { label: '≤ 45 min', value: '45' },
  { label: '≤ 60 min', value: '60' },
]

/**
 * The pantry control for /cook-from. Chips are the signed-in user's saved
 * pantry (Supabase); adding/removing writes a pantry row and refreshes so the
 * server re-computes what's cookable. Max-time stays a URL param (a filter, not
 * pantry state).
 */
export function PantryFinder({
  initialHave,
  initialTime,
  guest = false,
}: {
  initialHave: Ingredient[]
  initialTime: number | null
  /** Signed out: the pantry lives in the URL, not the database. */
  guest?: boolean
}) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Ingredient[]>([])
  const [open, setOpen] = useState(false)
  const [noMatch, setNoMatch] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const haveSlugs = new Set(initialHave.map((h) => h.slug))

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/cook-from/suggest?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal })
        const data = (await res.json()) as { suggestions?: Ingredient[] }
        setSuggestions((data.suggestions ?? []).filter((s) => !haveSlugs.has(s.slug)))
      } catch {
        // aborted or offline — leave suggestions as they are
      }
    }, 200)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const add = async (ing: Ingredient) => {
    if (guest) {
      setQuery('')
      setSuggestions([])
      guestAdd(ing.slug)
      return
    }
    if (!supabase || busy) return
    setBusy(true)
    setQuery('')
    setSuggestions([])
    try {
      const { error } = await supabase
        .from('pantry')
        .upsert(
          { ingredient_slug: ing.slug, ingredient_name: ing.name, is_staple: false },
          { onConflict: 'user_id,ingredient_slug' },
        )
      if (!error) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (slug: string) => {
    if (guest) {
      guestRemove(slug)
      return
    }
    if (!supabase || busy) return
    setBusy(true)
    try {
      // Scope to this user: the pantry RLS policy also grants access to a
      // household's rows, so deleting by slug alone takes a partner's with it.
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { error } = await supabase
        .from('pantry')
        .delete()
        .eq('user_id', auth.user.id)
        .eq('ingredient_slug', slug)
      if (!error) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const pushParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search)
    mutate(params)
    const qs = params.toString()
    router.push(`/cook-from${qs ? `?${qs}` : ''}`)
  }

  const setTime = (value: string) =>
    pushParams((p) => (value ? p.set('time', value) : p.delete('time')))

  /** Guest pantry: same add/remove, stored in `?have=` instead of Supabase. */
  const guestSlugs = () => initialHave.map((h) => h.slug)
  const guestAdd = (slug: string) =>
    pushParams((p) => p.set('have', [...new Set([...guestSlugs(), slug])].join(',')))
  const guestRemove = (slug: string) =>
    pushParams((p) => {
      const next = guestSlugs().filter((s) => s !== slug)
      if (next.length) p.set('have', next.join(','))
      else p.delete('have')
    })

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {initialHave.map((h) => (
          <span key={h.slug} className="chip !cursor-default">
            {h.name}
            <button
              type="button"
              onClick={() => void remove(h.slug)}
              aria-label={`Remove ${h.name}`}
              className="ml-1.5 cursor-pointer border-none bg-transparent p-0 text-slate hover:text-heat"
            >
              ✕
            </button>
          </span>
        ))}
        {initialHave.length === 0 && (
          <span className="text-[0.9375rem] text-slate/70">Add what’s in your kitchen…</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div ref={rootRef} className="relative min-w-[16rem] flex-1">
          <input
            type="text"
            value={query}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              // Enter took the first suggestion — or said nothing matched.
              // Before, typing "eggs" and pressing Enter did nothing at all:
              // no chip, no error, no hint that a suggestion had to be clicked.
              if (suggestions[0]) void add(suggestions[0])
              else if (query.trim().length >= 2) setNoMatch(query.trim())
            }}
            onChange={(e) => {
              setNoMatch(null)
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="e.g. chicken thigh"
            className="w-full rounded border border-rule bg-transparent px-3 py-2 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
          />
          {noMatch && (
            <p role="status" className="mt-1.5 m-0 font-mono text-[0.75rem] text-slate">
              Nothing in the pantry called “{noMatch}” — try a simpler word, like the
              ingredient on its own.
            </p>
          )}
          {open && suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Ingredient suggestions"
              className="scroll-rail absolute top-full left-0 z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-ink/30 bg-card p-1.5 text-ink shadow-(--shadow-block)"
            >
              {suggestions.map((s) => (
                <li key={s.slug} role="option" aria-selected={false}>
                  <button
                    type="button"
                    disabled={busy}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      void add(s)
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
        <label className="flex items-center gap-2">
          <span className="eyebrow">Max time</span>
          <Select value={initialTime ? String(initialTime) : ''} onChange={setTime} ariaLabel="Max time">
            {TIME_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  )
}
