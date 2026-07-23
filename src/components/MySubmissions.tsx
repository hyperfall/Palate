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

/** Creator-facing status: honest, plain labels rather than the admin enum. */
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'In review', cls: 'text-slate' },
  approved: { label: 'Published', cls: 'text-richness' },
  rejected: { label: 'Not accepted', cls: 'text-heat' },
}

/**
 * "Your recipes" — a creator's own submissions and where each one stands, so
 * publishing isn't a black box after the submit button. Fetches the caller's
 * own rows (server-authed) and hides itself entirely when there are none.
 */
export function MySubmissions() {
  const [subs, setSubs] = useState<Submission[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/studio/submissions')
      .then((res) => (res.ok ? res.json() : { submissions: [] }))
      .then((data) => {
        if (!cancelled) setSubs(data.submissions ?? [])
      })
      .catch(() => {
        if (!cancelled) setSubs([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!subs || subs.length === 0) return null

  return (
    <section className="mb-10 max-w-[52rem]">
      <p className="eyebrow m-0">Your recipes</p>
      <ul className="mt-3 grid list-none gap-0 p-0">
        {subs.map((s) => {
          const st = STATUS[s.status] ?? STATUS.pending
          return (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 border-b border-rule py-2.5"
            >
              <span className="min-w-0 truncate font-body text-[1rem] text-ink">
                {s.recipeSlug ? (
                  <Link href={`/recipes/${s.recipeSlug}`} className="no-underline hover:text-flame">
                    {s.title}
                  </Link>
                ) : (
                  s.title
                )}
              </span>
              <span
                className={`shrink-0 font-mono text-[0.75rem] font-medium tracking-[0.08em] uppercase ${st.cls}`}
              >
                {st.label}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
