'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { displayName, parseCosting, readDraft, type Costing } from '@/lib/costing'
import { formatMoney } from '@/lib/money'
import { supabaseBrowser } from '@/lib/supabase/client'

/**
 * Everything you have costed, newest first.
 *
 * An unsaved draft is listed alongside the saved ones rather than hidden, so
 * work in progress is never something you have to remember you left somewhere.
 * Signed out, the draft is the only entry there can be.
 */

type Row = { costing: Costing; updatedAt: string | null; draft: boolean }

export function CostingList() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      const draft = readDraft()
      const draftRow: Row[] = draft ? [{ costing: draft, updatedAt: null, draft: true }] : []

      const supabase = supabaseBrowser()
      if (!supabase) {
        if (live) setRows(draftRow)
        return
      }
      const { data: auth } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (!live) return
      if (!auth?.user) {
        setRows(draftRow)
        return
      }
      setSignedIn(true)

      const { data } = await supabase
        .from('costings')
        .select('id,name,servings,currency,items,source_recipe_slug,updated_at')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (!live) return

      const saved: Row[] = ((data ?? []) as Array<Record<string, unknown>>)
        .map((r) => {
          const costing = parseCosting(r)
          return costing
            ? { costing, updatedAt: (r.updated_at as string | null) ?? null, draft: false }
            : null
        })
        .filter((r): r is Row => r !== null)

      setRows([...draftRow, ...saved])
    })()
    return () => {
      live = false
    }
  }, [])

  async function remove(id: string) {
    const supabase = supabaseBrowser()
    if (!supabase) return
    await supabase.from('costings').delete().eq('id', id)
    setRows((r) => (r ?? []).filter((x) => x.costing.id !== id))
  }

  if (rows === null) return <div className="skeleton mt-8 h-40 w-full" aria-hidden="true" />

  return (
    <div className="mt-8">
      <Link href="/calculator/new" className="btn-primary inline-flex">
        New costing
      </Link>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-[48ch] text-slate">
          Nothing costed yet. Start one above, or open any recipe and use “Cost this yourself” to
          begin from its ingredients.
        </p>
      ) : (
        <ul className="mt-8 list-none p-0">
          {rows.map(({ costing, updatedAt, draft }) => {
            const items = costing.items.length
            return (
              <li
                key={costing.id ?? 'draft'}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule py-4"
              >
                <div className="min-w-[12rem] flex-1">
                  <Link
                    href={`/calculator/${costing.id ?? 'new'}`}
                    className="font-body text-[1.05rem] text-ink no-underline hover:text-flame"
                  >
                    {displayName(costing)}
                  </Link>
                  <p className="m-0 font-mono text-caption text-slate">
                    {items} {items === 1 ? 'ingredient' : 'ingredients'} · serves {costing.servings}
                    {draft && ' · not saved yet'}
                    {updatedAt && ` · ${new Date(updatedAt).toLocaleDateString('en-GB')}`}
                  </p>
                </div>

                <span className="font-mono text-caption text-slate">
                  {formatMoney(0, costing.currency)?.replace(/[\d.,]+/, '') ?? ''}
                  {costing.currency}
                </span>

                {costing.id && (
                  <button
                    type="button"
                    onClick={() => void remove(costing.id!)}
                    aria-label={`Delete ${displayName(costing)}`}
                    className="cursor-pointer border-none bg-transparent p-1 text-slate hover:text-heat"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!signedIn && (
        <p className="mt-8 max-w-[52ch] text-eyebrow leading-snug text-slate">
          <Link href="/account" className="text-flame">
            Sign in
          </Link>{' '}
          to keep more than one, and to share them — and the prices you correct — with your
          household.
        </p>
      )}
    </div>
  )
}
