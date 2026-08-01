'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import Link from 'next/link'

import { slugify } from '@/fields/slug'
import type { ShoppingLine, WeekShoppingList } from '@/lib/mealPlan'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useDialogFocus } from '@/lib/useDialogFocus'
import { useShoppingChecks } from '@/lib/useShoppingChecks'


function CheckCircle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
        // on-flame, not milk: milk on flame measures 2.96:1, under even the
        // 3:1 floor for a UI component, and this tick IS the state. The token
        // exists for exactly this pairing and .btn-primary already uses it —
        // 4.63:1 light, 5.21:1 dark.
        on ? 'border-flame bg-flame text-on-flame' : 'border-rule text-transparent'
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

export function ShoppingMode({ list, onClose }: { list: WeekShoppingList; onClose: () => void }) {
  const { checked, toggle, clearAll, synced } = useShoppingChecks()
  const [view, setView] = useState<'all' | 'dish'>('all')
  const [stocking, setStocking] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

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

  // Escape, the Tab trap, initial focus, focus restore and the scroll lock all
  // come from the shared hook. This overlay hand-rolled only Escape and the
  // lock, so a keyboard user tabbed straight out of a full-screen takeover into
  // the page behind it — visually covered, still focusable, and by then they
  // are typing into something they cannot see. Cook mode, the same shape of
  // takeover, was already on the hook; this one was missed.
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus({ open: true, ref: dialogRef, onClose })

  const total = list.netted.length
  const done = list.netted.filter((l) => checked.has(l.key)).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total

  const toBuy = list.netted.filter((l) => !checked.has(l.key))
  const inBasket = list.netted.filter((l) => checked.has(l.key))

  /**
   * Close the loop. The cook has just told us exactly what they now own; until
   * now that knowledge died with the basket and cook-from started empty again.
   * Bought stock is not a staple — is_staple stays false, so "have it" on the
   * shopping list keeps its separate, permanent meaning.
   */
  const stockPantry = async () => {
    const supabase = supabaseBrowser()
    if (!supabase || inBasket.length === 0) return
    setStocking('saving')

    // Use the canonical slug the line already carries. Deriving one from the
    // display name looked equivalent and isn't: a renamed ingredient keeps its
    // original slug, so the row would land under a slug no canonical record
    // has, cook-from would resolve it to id: null and silently ignore it — the
    // cook told they were stocked while nothing changed.
    const rows = new Map<string, { ingredient_slug: string; ingredient_name: string; is_staple: boolean }>()
    for (const line of inBasket) {
      const slug = line.slug ?? slugify(line.name)
      // Deduplicate: two lines resolving to one slug in a single upsert makes
      // Postgres reject the whole batch ("cannot affect row a second time").
      if (!rows.has(slug)) {
        rows.set(slug, { ingredient_slug: slug, ingredient_name: line.name, is_staple: false })
      }
    }

    const { error } = await supabase
      .from('pantry')
      .upsert([...rows.values()], { onConflict: 'user_id,ingredient_slug' })
    setStocking(error ? 'error' : 'done')
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Shopping mode"
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col bg-paper text-ink outline-none"
    >
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
          {done > 0 && (
            <div className="mt-8 rounded-lg border border-flame/40 bg-flame/5 px-5 py-6 text-center">
              <p className="m-0 font-display text-[1.5rem] text-ink">
                {allDone ? 'Basket complete.' : `${done} in the basket.`}
              </p>
              {stocking === 'done' ? (
                <>
                  <p className="mt-1 text-slate">
                    In your pantry. The board knows what you can cook now.
                  </p>
                  <Link href="/cook-from" className="btn-primary mt-4 inline-block">
                    Cook from what you have →
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-1 text-slate">
                    Put it in your pantry and you won’t have to tell us twice.
                  </p>
                  <button
                    type="button"
                    onClick={() => void stockPantry()}
                    disabled={stocking === 'saving'}
                    className="btn-primary mt-4 disabled:opacity-60"
                  >
                    {stocking === 'saving'
                      ? 'Stocking…'
                      : `Add ${done} ${done === 1 ? 'item' : 'items'} to my pantry`}
                  </button>
                  {stocking === 'error' && (
                    <p role="alert" className="mt-2 m-0 font-mono text-[0.75rem] text-heat">
                      Couldn’t stock the pantry — try again.
                    </p>
                  )}
                </>
              )}
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
