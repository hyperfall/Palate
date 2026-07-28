'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { groupSubstitutions, type SubRow } from '@/lib/substitutions'

/**
 * A recipe-page ingredient with curated swaps. The name becomes a tappable
 * dotted-underline button; tapping opens a small disclosure grouped as
 * flavour / texture / cupboard. Ingredients with no curated subs never render
 * this — the caller checks first.
 */
export function SubstitutionPopover({
  item,
  substitutions,
  canonicalSlug,
  canonicalName,
}: {
  item: string
  substitutions: SubRow[]
  /** When known, the panel offers a way through to the ingredient's own page. */
  canonicalSlug?: string | null
  canonicalName?: string | null
}) {
  const [open, setOpen] = useState(false)
  // Flip the panel toward whichever edge has room so it never clips off-screen
  // (right edge of the ingredients column, or the bottom of cook mode's rail).
  const [pos, setPos] = useState<{ right: boolean; up: boolean }>({ right: false, up: false })
  const rootRef = useRef<HTMLSpanElement>(null)
  const groups = groupSubstitutions(substitutions)

  useEffect(() => {
    if (!open || !rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    const W = 272 // ~17rem
    const H = 320 // generous upper bound for the panel
    setPos({
      right: r.left + W > window.innerWidth - 8,
      up: r.bottom + H > window.innerHeight - 8,
    })
  }, [open])

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
        <span
          className={`absolute z-40 block w-[min(17rem,90vw)] max-h-[min(20rem,70vh)] overflow-y-auto rounded-md border border-ink/25 bg-card p-3.5 text-ink shadow-(--shadow-block) ${
            pos.right ? 'right-0' : 'left-0'
          } ${pos.up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
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
          {canonicalSlug && (
            // Someone asking "what can I use instead" is one question away from
            // "what else can I make with this" — the ingredient page answers it.
            <Link
              href={`/ingredients/${canonicalSlug}`}
              className="mt-3 block border-t border-rule pt-2.5 font-mono text-[0.6875rem] tracking-[0.1em] text-slate uppercase no-underline hover:text-flame"
            >
              Everything with {canonicalName ?? item} →
            </Link>
          )}
        </span>
      )}
    </span>
  )
}
