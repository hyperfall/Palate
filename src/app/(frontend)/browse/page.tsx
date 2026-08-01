import type { Metadata } from 'next'
import Link from 'next/link'

import { COLLECTIONS } from '@/lib/collections'

export const metadata: Metadata = {
  // Not "Collections": that word already names the folders a user builds at
  // /collections, and two unrelated features sharing a noun is how someone
  // ends up on the wrong page. This one is the editorial cut of the catalog,
  // which is what its own heading has always called it.
  title: 'Ways in',
  description: 'Curated ways into the catalog — one-pan dinners, under £2 a serving, batch-and-keep, and more.',
}

export const revalidate = 3600

export default function BrowseIndex() {
  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Ways in</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">Ways in.</h1>
        <p className="mt-3 text-slate max-sm:hidden">Curated cuts of the catalog for a mood, a budget, or a busy week.</p>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {COLLECTIONS.map((c) => (
          <Link key={c.slug} href={`/browse/${c.slug}`} className="ticket-card block p-6 no-underline">
            <h2 className="text-[1.375rem] text-ink">{c.title}</h2>
            <p className="mt-2 text-[0.9375rem] leading-snug text-slate">{c.blurb}</p>
            <span className="mt-4 inline-block font-mono text-[0.75rem] tracking-[0.1em] text-flame uppercase">
              Browse →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
