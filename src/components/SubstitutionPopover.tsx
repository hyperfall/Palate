'use client'

import { useEffect, useRef, useState } from 'react'

import { groupSubstitutions, type SubRow } from '@/lib/substitutions'

/**
 * A recipe-page ingredient with curated swaps. The name becomes a tappable
 * dotted-underline button; tapping opens a small disclosure grouped as
 * flavour / texture / cupboard. Ingredients with no curated subs never render
 * this — the caller checks first.
 */
export function SubstitutionPopover({ item, substitutions }: { item: string; substitutions: SubRow[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const groups = groupSubstitutions(substitutions)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="cursor-pointer border-none bg-transparent p-0 text-left font-inherit text-ink underline decoration-dotted decoration-rule underline-offset-4 hover:decoration-flame"
      >
        {item}
      </button>
      {open && (
        <span className="absolute top-full left-0 z-40 mt-1.5 block w-[17rem] rounded-md border border-ink/25 bg-card p-3.5 text-ink shadow-(--shadow-block)">
          <span className="eyebrow block">Swap for</span>
          {groups.map((group) => (
            <span key={group.kind} className="mt-2.5 block">
              <span className="block font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-flame">
                {group.title}
              </span>
              <span className="mt-1 block">
                {group.items.map((sub, i) => (
                  <span key={i} className="block py-0.5 text-[0.9375rem] leading-snug">
                    {sub.label}
                    {sub.ratio ? <span className="text-slate"> · {sub.ratio}</span> : null}
                    {sub.note ? <span className="block text-[0.8125rem] text-slate">{sub.note}</span> : null}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
