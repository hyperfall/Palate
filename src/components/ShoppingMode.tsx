'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { ShoppingLine, WeekShoppingList } from '@/lib/mealPlan'
import { useShoppingChecks } from '@/lib/useShoppingChecks'

/**
 * Shopping Mode: a focused, full-screen checklist for the aisles. Tap an item to
 * drop it in the basket — it crosses out and sinks; tap again to put it back.
 * Progress up top, wake lock on, and (in a household) checks sync live between
 * members. Netted "everything to buy" by default, with a by-dish view.
 */
export function ShoppingModeLauncher({ list }: { list: WeekShoppingList }) {
  const [open, setOpen] = useState(false)
  if (list.netted.length === 0) return null

  return (
    <div className="mt-5">
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full sm:w-auto">
        Shopping mode →
      </button>
      {open && <ShoppingMode list={list} onClose={() => setOpen(false)} />}
    </div>
  )
}

function CheckCircle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
        on ? 'border-flame bg-flame text-milk' : 'border-rule text-transparent'
      }`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 10 17l9-10" />
      </svg>
    </span>
  )
}

function Row({ line, on, onToggle }: { line: ShoppingLine; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="flex w-full items-center gap-4 border-b border-rule py-3.5 text-left"
    >
      <CheckCircle on={on} />
      <span className="min-w-0 flex-1">
        <span className={`text-[1.1875rem] leading-tight ${on ? 'text-slate line-through' : 'text-ink'}`}>
          {line.name}
        </span>
        {line.amounts.length > 0 && (
          <span className={`ml-2 font-mono text-[0.8125rem] ${on ? 'text-slate/70 line-through' : 'text-slate'}`}>
            {line.amounts.join(' + ')}
          </span>
        )}
      </span>
    </button>
  )
}

function ShoppingMode({ list, onClose }: { list: WeekShoppingList; onClose: () => void }) {
  const { checked, toggle, clearAll, synced } = useShoppingChecks()
  const [view, setView] = useState<'all' | 'dish'>('all')

  // Keep the screen awake while shopping; release on close.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    let cancelled = false
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    nav.wakeLock?.request('screen').then((l) => {
      if (cancelled) void l.release()
      else lock = l
    }).catch(() => {})
    return () => {
      cancelled = true
      void lock?.release()
    }
  }, [])

  // Esc closes; lock body scroll behind the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const total = list.netted.length
  const done = list.netted.filter((l) => checked.has(l.key)).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total

  const toBuy = list.netted.filter((l) => !checked.has(l.key))
  const inBasket = list.netted.filter((l) => checked.has(l.key))

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper text-ink">
      {/* Progress rail */}
      <div className="h-1 w-full bg-rule">
        <div className="h-full bg-flame transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3.5 sm:px-8">
        <div className="min-w-0">
          <p className="eyebrow m-0 text-flame">Shopping</p>
          <p className="m-0 font-mono text-[0.8125rem] text-slate">
            <span className="tabular-nums text-ink">{done}</span> of{' '}
            <span className="tabular-nums">{total}</span> in the basket
            {synced && <span className="ml-2 text-slate/70">· synced</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close shopping mode"
          className="flex shrink-0 items-center gap-2 rounded-full border border-rule py-1.5 pr-3 pl-2.5 text-ink transition-colors hover:border-flame hover:text-flame"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
          <span className="font-mono text-[0.75rem] tracking-[0.1em] uppercase">Close</span>
        </button>
      </header>

      {/* View toggle */}
      <div className="flex gap-2 border-b border-rule px-5 py-2.5 sm:px-8">
        {(['all', 'dish'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`chip ${view === v ? 'border-ink bg-ink text-paper' : ''}`}
          >
            {v === 'all' ? 'Everything' : 'By dish'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-[40rem]">
          {allDone && (
            <div className="mt-8 rounded-lg border border-flame/40 bg-flame/5 px-5 py-6 text-center">
              <p className="m-0 font-display text-[1.5rem] text-ink">Basket complete.</p>
              <p className="mt-1 text-slate">Everything on the list is in. Happy cooking.</p>
            </div>
          )}

          {view === 'all' ? (
            <>
              {toBuy.length > 0 && (
                <ul className="mt-4 grid list-none gap-0 p-0">
                  {toBuy.map((l) => (
                    <li key={l.key}>
                      <Row line={l} on={false} onToggle={() => void toggle(l.key)} />
                    </li>
                  ))}
                </ul>
              )}
              {inBasket.length > 0 && (
                <div className="mt-8">
                  <p className="eyebrow m-0 text-slate">In the basket ({inBasket.length})</p>
                  <ul className="mt-2 grid list-none gap-0 p-0 opacity-70">
                    {inBasket.map((l) => (
                      <li key={l.key}>
                        <Row line={l} on onToggle={() => void toggle(l.key)} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 grid gap-7">
              {list.dishes.map((dish) => (
                <section key={dish.slug}>
                  <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-1.5">
                    <h2 className="font-display text-[1.125rem] text-ink">{dish.title}</h2>
                    <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">
                      {dish.lines.filter((l) => checked.has(l.key)).length}/{dish.lines.length}
                    </span>
                  </div>
                  <ul className="grid list-none gap-0 p-0">
                    {dish.lines.map((l) => (
                      <li key={l.key}>
                        <Row line={l} on={checked.has(l.key)} onToggle={() => void toggle(l.key)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 border-t border-rule bg-paper px-5 py-3 sm:px-8">
        <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">
          Tap an item to check it off
        </span>
        {done > 0 && (
          <button
            type="button"
            onClick={() => void clearAll()}
            className="font-mono text-[0.75rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
          >
            Clear all
          </button>
        )}
      </footer>
    </div>,
    document.body,
  )
}
