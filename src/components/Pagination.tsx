import Link from 'next/link'

import { catalogHref, type CatalogFilters } from '@/lib/filters'

/**
 * Catalog pager, ticket-styled. Plain links (crawlable, works without JS),
 * preserving every active filter. Windowed so a long catalog shows first ·
 * current neighbourhood · last rather than a hundred numbers, with a mono
 * "page X / Y" readout on the side.
 */
export function Pagination({
  filters,
  page,
  totalPages,
}: {
  filters: CatalogFilters
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null

  const href = (p: number) => catalogHref({ ...filters, page: p })

  // First, last, and a window of ±1 around current — dedupe, keep gaps.
  const raw = [1, page - 1, page, page + 1, totalPages].filter((p) => p >= 1 && p <= totalPages)
  const windowed = [...new Set(raw)].sort((a, b) => a - b)

  const stepCls =
    'grid h-9 min-w-[2.25rem] place-items-center rounded border border-rule px-2 font-mono text-[0.8125rem] font-medium text-ink no-underline transition-colors hover:border-ink'

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-3"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={stepCls} rel="prev">
          ← Prev
        </Link>
      ) : (
        <span className={`${stepCls} cursor-default opacity-40`}>← Prev</span>
      )}

      <div className="flex items-center gap-1.5">
        {windowed.map((p, i) => {
          const gap = i > 0 && p - windowed[i - 1] > 1
          return (
            <span key={p} className="flex items-center gap-1.5">
              {gap && <span className="px-0.5 font-mono text-[0.8125rem] text-slate">·</span>}
              {p === page ? (
                <span
                  aria-current="page"
                  className="grid h-9 min-w-[2.25rem] place-items-center rounded bg-flame px-2 font-mono text-[0.8125rem] font-bold text-paper tabular-nums"
                >
                  {p}
                </span>
              ) : (
                <Link href={href(p)} className={`${stepCls} tabular-nums`}>
                  {p}
                </Link>
              )}
            </span>
          )
        })}
      </div>

      {page < totalPages ? (
        <Link href={href(page + 1)} className={stepCls} rel="next">
          Next →
        </Link>
      ) : (
        <span className={`${stepCls} cursor-default opacity-40`}>Next →</span>
      )}

      <span className="ml-1 font-mono text-[0.75rem] tracking-[0.06em] text-slate uppercase">
        Page {page} / {totalPages}
      </span>
    </nav>
  )
}
