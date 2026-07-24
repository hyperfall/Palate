'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Submission = {
  id: number | string
  title: string
  status: string
  createdAt: string
  recipeSlug: string | null
}

type Page = { submissions: Submission[]; total: number; page: number; totalPages: number }

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
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
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

  // Debounce the search box; reset to page 1 on any query/filter change.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => setPage(1), [debouncedQ, status])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (debouncedQ) params.set('q', debouncedQ)
    if (status) params.set('status', status)
    fetch(`/studio/submissions?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: Page | null) => {
        if (!cancelled) setData(d ?? { submissions: [], total: 0, page: 1, totalPages: 1 })
      })
      .catch(() => {
        if (!cancelled) setData({ submissions: [], total: 0, page: 1, totalPages: 1 })
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, debouncedQ, status])

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
          className="min-w-0 flex-1 rounded border border-rule bg-transparent px-3 py-1.5 text-[0.9375rem] text-ink"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              aria-pressed={status === f.key}
              onClick={() => setStatus(f.key)}
              className={`chip ${status === f.key ? 'border-ink bg-ink text-milk' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <p className="mt-6 text-slate">Loading…</p>
      ) : total === 0 ? (
        <p className="mt-6 text-[0.9375rem] text-slate">
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
                    <span className="font-mono text-[0.6875rem] tracking-[0.06em] text-slate">{fmtDate(s.createdAt)}</span>
                  </span>
                  <span className={`shrink-0 font-mono text-[0.75rem] font-medium tracking-[0.08em] uppercase ${st.cls}`}>
                    {st.label}
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
              <span className="font-mono text-[0.75rem] tracking-[0.08em] text-slate uppercase">
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
