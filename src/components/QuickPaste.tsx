'use client'

import { useMemo, useState } from 'react'

import { parseRecipeText, type ParsedRecipe } from '@/lib/recipeParse'

/**
 * Quick mode: paste a recipe, see what was understood, then land in the editor.
 *
 * The preview between paste and apply is the whole point — the creator confirms
 * the split before it touches their form, so a wrong guess costs a glance
 * instead of a cleanup. Applying never overwrites a field the paste didn't
 * fill.
 */
export function QuickPaste({
  onApply,
  onCancel,
}: {
  onApply: (parsed: ParsedRecipe) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => (text.trim() ? parseRecipeText(text) : null), [text])
  const usable = Boolean(parsed && (parsed.ingredientRows.length > 0 || parsed.stepRows.length > 0))

  return (
    <div className="rounded-lg border border-flame/40 bg-flame/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="m-0 text-title">Paste your recipe. We’ll lay it out.</h2>
          <p className="mt-1 max-w-[54ch] text-note text-slate">
            From your notes, a doc, a message to a friend, anything. You’ll check it before it
            fills the form.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-tag tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-flame hover:underline"
        >
          Type it out instead
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          autoFocus
          aria-label="Paste your recipe"
          placeholder={'Birria Tacos\nserves 2, 1 h 15\n\n1 tbsp sunflower oil\n1kg braising steak\n4 guajillo chillies\n\nBrown the steak all over, about 8 minutes.\nToast the chillies, then blend until smooth.'}
          className="w-full resize-y rounded border border-rule bg-card px-3 py-2 font-mono text-detail leading-relaxed text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
        />

        <div className="rounded border border-rule bg-card p-4">
          {!parsed ? (
            <p className="m-0 text-note text-slate">
              What we understand will appear here as you paste.
            </p>
          ) : (
            <>
              <p className="eyebrow m-0">What we understood</p>
              <p className="mt-2 text-read text-ink">
                {parsed.title || <span className="text-slate">No title found. Add one after</span>}
              </p>
              <p className="mt-1 font-mono text-caption text-slate">
                {[
                  parsed.servings ? `serves ${parsed.servings}` : null,
                  parsed.prepMinutes ? `prep ${parsed.prepMinutes} min` : null,
                  parsed.cookMinutes ? `cook ${parsed.cookMinutes} min` : null,
                  `${parsed.ingredientRows.length} ingredients`,
                  `${parsed.stepRows.length} steps`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              <ul className="mt-3 grid max-h-40 list-none gap-1 overflow-auto p-0">
                {parsed.ingredientRows.slice(0, 8).map((row, i) =>
                  row.heading ? (
                    <li key={i} className="eyebrow pt-1 text-ink">
                      {row.item}
                    </li>
                  ) : (
                    <li key={i} className="flex items-baseline gap-2 text-eyebrow text-ink">
                      <span className="min-w-[3.5rem] shrink-0 font-mono text-caption text-flame">
                        {[row.quantity, row.unit].filter(Boolean).join(' ') || '—'}
                      </span>
                      <span className="min-w-0 break-words">{row.item}</span>
                    </li>
                  ),
                )}
                {parsed.ingredientRows.length > 8 && (
                  <li className="font-mono text-caption text-slate">
                    + {parsed.ingredientRows.length - 8} more
                  </li>
                )}
              </ul>

              <button
                type="button"
                disabled={!usable}
                onClick={() => parsed && onApply(parsed)}
                className="btn-primary mt-4 disabled:opacity-50"
              >
                Looks right, fill the form
              </button>
              {!usable && (
                <p className="mt-2 font-mono text-tag tracking-[0.06em] text-slate uppercase">
                  Paste a few ingredients or steps to continue
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
