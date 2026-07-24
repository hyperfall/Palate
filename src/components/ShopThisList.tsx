'use client'

import { useState } from 'react'

import { Disclosure } from '@/components/Disclosure'
import { shoppingListText } from '@/lib/grocery'

export type ShopRetailer = { id: number | string; label: string; slug: string }
export type ShopLine = { key: string; name: string; amounts: string[] }

/**
 * The grocery handoff panel: pick a retailer (geo-selected server-side), every
 * netted shopping line becomes a tracked search link at that retailer, opened
 * in a new tab. Links go through /grocery/click so the destination is rebuilt
 * server-side and the click is logged. Renders nothing without retailers or
 * lines — the brandCards contract.
 */
export function ShopThisList({ retailers, lines }: { retailers: ShopRetailer[]; lines: ShopLine[] }) {
  const [active, setActive] = useState<ShopRetailer | null>(retailers[0] ?? null)
  const [copied, setCopied] = useState(false)

  if (retailers.length === 0 || lines.length === 0) return null

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(shoppingListText(lines))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="mt-6">
      <Disclosure
        title={<span className="font-display text-[1.125rem] text-ink">Shop this list</span>}
        meta={active ? active.label : undefined}
        defaultOpen={false}
      >
        <div className="flex flex-wrap items-center gap-2">
          {retailers.map((r) => (
            <button
              key={r.slug}
              type="button"
              aria-pressed={active?.slug === r.slug}
              onClick={() => setActive(r)}
              className={`chip ${active?.slug === r.slug ? 'border-ink bg-ink text-milk' : ''}`}
            >
              {r.label}
            </button>
          ))}
          <button type="button" onClick={() => void copy()} className="chip ml-auto">
            {copied ? 'Copied ✓' : 'Copy list'}
          </button>
        </div>

        {active && (
          <ul className="mt-3 grid list-none gap-1.5 p-0">
            {lines.map((line) => (
              <li key={line.key}>
                <a
                  href={`/grocery/click?r=${active.id}&q=${encodeURIComponent(line.name)}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="group flex items-baseline justify-between gap-3 border-b border-dotted border-rule pb-1.5 no-underline"
                >
                  <span className="text-[0.9375rem] text-ink group-hover:text-flame">
                    {line.name}
                    {line.amounts.length > 0 && <span className="text-slate"> — {line.amounts.join(' + ')}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase group-hover:text-flame">
                    find at {active.label} ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 mb-0 font-mono text-[0.6875rem] tracking-[0.06em] text-slate">
          Links open a search at the retailer. Some may earn Palate a commission — never at extra cost to you.
        </p>
      </Disclosure>
    </div>
  )
}
