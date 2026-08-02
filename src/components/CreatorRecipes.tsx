'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { supabaseBrowser } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format'

type Submission = {
  id: number | string
  title: string
  status: string
  createdAt: string
  recipeSlug: string | null
  recipeId: number | null
}

type Page = { submissions: Submission[]; total: number; page: number; totalPages: number }

/** Reach per published recipe. Counts only — never who. */
type Stat = { saves: number; cooks: number }

/** Creator-facing status: honest, plain labels rather than the admin enum. */
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'In review', cls: 'text-slate' },
  approved: { label: 'Published', cls: 'text-richness' },
  rejected: { label: 'Not accepted', cls: 'text-heat' },
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'approved', label: 'Published' },
  { key: 'pending', label: 'In review' },
  { key: 'rejected', label: 'Not accepted' },
] as const

const fmtDate = (iso: string) => {
  try {
    return formatDate(iso)
  } catch {
    return ''
  }
}

/**
 * The creator's recipe portfolio: search by title, filter by status, paginated
 * against /studio/submissions (server-authed to the caller). Scales past the old
 * 100-row cap — a creator with hundreds of recipes browses them here rather than
 * on the submission form.
 */
export function CreatorRecipes() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // Debounce the search box; reset to page 1 on any query/filter change.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => setPage(1), [debouncedQ, status])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    const params = new URLSearchParams({ page: String(page) })
    if (debouncedQ) params.set('q', debouncedQ)
    if (status) params.set('status', status)
    fetch(`/studio/submissions?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: Page | null) => {
        if (cancelled) return
        // A failed request is not an empty portfolio. Collapsing the two told a
        // creator with a shelf full of recipes that they had none.
        if (!d) {
          setFailed(true)
          return
        }
        setFailed(false)
        setData(d)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, debouncedQ, status])

  // Reach for the recipes on this page. Goes through the recipe_stats
  // security-definer function because a creator cannot read other people's
  // collection or cook rows — and must not be able to. It returns counts only.
  const [stats, setStats] = useState<Record<string, Stat>>({})
  useEffect(() => {
    const supabase = supabaseBrowser()
    const slugs = (data?.submissions ?? []).map((s) => s.recipeSlug).filter((x): x is string => Boolean(x))
    if (!supabase || slugs.length === 0) return
    let cancelled = false
    void supabase
      .rpc('recipe_stats', { slugs })
      .then(({ data: rows, error }) => {
        if (cancelled || error || !rows) return
        const next: Record<string, Stat> = {}
        for (const r of rows as Array<{ recipe_slug: string; saves: number; cooks: number }>) {
          next[r.recipe_slug] = { saves: Number(r.saves), cooks: Number(r.cooks) }
        }
        setStats(next)
      })
    return () => {
      cancelled = true
    }
  }, [data])

  const isFiltering = Boolean(debouncedQ || status)
  const total = data?.total ?? 0

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[1.375rem] text-ink">Your recipes</h2>
        <Link href="/studio" className="btn-primary">
          New recipe →
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your recipes…"
          aria-label="Search your recipes"
          className="min-w-0 flex-1 rounded border border-rule bg-transparent px-3 py-1.5 text-note text-ink"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              aria-pressed={status === f.key}
              onClick={() => setStatus(f.key)}
              className={`chip ${status === f.key ? 'border-ink bg-ink text-paper' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <ul className="mt-4 grid list-none gap-0 p-0" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="skeleton my-1 h-10 w-full" />
          ))}
        </ul>
      ) : failed ? (
        <p role="alert" className="mt-6 text-note text-slate">
          Couldn’t load your recipes just now — they’re safe. Refresh to try again.
        </p>
      ) : total === 0 ? (
        <p className="mt-6 text-note text-slate">
          {isFiltering ? 'No recipes match that.' : 'No recipes yet — '}
          {!isFiltering && (
            <Link href="/studio" className="text-flame underline underline-offset-4">
              submit your first
            </Link>
          )}
          {!isFiltering && '.'}
        </p>
      ) : (
        <>
          <ul className="mt-4 grid list-none gap-0 p-0">
            {data!.submissions.map((s) => {
              const st = STATUS[s.status] ?? STATUS.pending
              return (
                <li key={s.id} className="flex items-center justify-between gap-4 border-b border-rule py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-[1rem] text-ink">
                      {s.recipeSlug ? (
                        <Link href={`/recipes/${s.recipeSlug}`} className="no-underline hover:text-flame">
                          {s.title}
                        </Link>
                      ) : (
                        s.title
                      )}
                    </span>
                    <span className="font-mono text-tag tracking-[0.06em] text-slate">
                      {fmtDate(s.createdAt)}
                      {/* Only once it's live and someone has actually done
                          something — a row of zeroes on a day-old recipe reads
                          as failure rather than as "too early to tell". */}
                      {s.recipeSlug && (stats[s.recipeSlug]?.saves || stats[s.recipeSlug]?.cooks) ? (
                        <>
                          {' · '}
                          <span className="text-ink">{stats[s.recipeSlug].saves}</span> saved
                          {' · '}
                          <span className="text-ink">{stats[s.recipeSlug].cooks}</span> cooked
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {s.recipeId && (
                      <Link
                        href={`/studio?edit=${s.recipeId}`}
                        className="font-mono text-tag tracking-[0.08em] text-slate uppercase underline-offset-2 hover:text-flame hover:underline"
                      >
                        Edit
                      </Link>
                    )}
                    <span className={`font-mono text-caption font-medium tracking-[0.08em] uppercase ${st.cls}`}>
                      {st.label}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>

          {data!.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="chip disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="font-mono text-caption tracking-[0.08em] text-slate uppercase">
                Page {data!.page} of {data!.totalPages} · {total} {total === 1 ? 'recipe' : 'recipes'}
              </span>
              <button
                type="button"
                disabled={page >= data!.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="chip disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
