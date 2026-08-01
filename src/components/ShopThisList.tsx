'use client'

import { useEffect, useMemo, useState } from 'react'

import { Disclosure } from '@/components/Disclosure'
import { retailersForCountry, shoppingListText } from '@/lib/grocery'
import { ALL_COUNTRY_CODES } from '@/lib/countries'
import { retailerTile } from '@/lib/retailerBrand'
import { SHOP_LOGOS } from '@/lib/shopLogos'

export type ShopRetailer = {
  id: number | string
  label: string
  slug: string
  countries: Array<{ code: string }>
  priority: number
  active: boolean
}
export type ShopLine = { key: string; name: string; amounts: string[] }

const COUNTRY_KEY = 'palate:shop-country'

/** ISO-2 → readable name, for the picker. Falls back to the code itself. */
const countryName = (code: string): string => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * The grocery handoff panel: pick a retailer, every netted shopping line
 * becomes a tracked search link, opened in a new tab (links go through
 * /grocery/click so the destination is rebuilt server-side and logged).
 *
 * The country is the viewer's decision, not the IP header's: the header only
 * sets the default; a picker covers VPNs, travel and dev, and the choice
 * persists locally. An uncovered country keeps the Copy-list button and says
 * so honestly instead of vanishing — the old contract of rendering nothing
 * made the panel look broken from most of the world.
 */
export function ShopThisList({
  retailers,
  defaultCountry,
  detected = false,
  lines,
}: {
  retailers: ShopRetailer[]
  defaultCountry: string | null
  /** Whether defaultCountry came from the edge or is just the fallback. */
  detected?: boolean
  lines: ShopLine[]
}) {
  const [country, setCountry] = useState<string | null>(defaultCountry)
  // Whether a saved pick is currently overriding the detected country.
  const [overridden, setOverridden] = useState(false)
  const [active, setActive] = useState<ShopRetailer | null>(null)
  const [copied, setCopied] = useState(false)

  // A remembered choice beats the header — read after mount so hydration
  // matches the server render of the header-detected default.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COUNTRY_KEY)
      if (saved) {
        setCountry(saved)
        setOverridden(saved !== defaultCountry)
      }
    } catch {
      /* storage unavailable — the header default stands */
    }
  }, [defaultCountry])

  const eligible = useMemo(() => retailersForCountry(retailers, country), [retailers, country])

  // Every country, split into served and not-yet. The site carries 208
  // cuisines; a picker that only lists covered countries tells everyone else
  // their home doesn't exist. Picking an unserved country is a real choice —
  // it gets the copy-list fallback and remembers, same as any other.
  const { covered, uncovered } = useMemo(() => {
    const has = new Set<string>()
    for (const r of retailers) for (const c of r.countries) has.add(c.code.toUpperCase())
    const named = (codes: string[]) =>
      codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name))
    return {
      covered: named([...has]),
      uncovered: named(ALL_COUNTRY_CODES.filter((c) => !has.has(c))),
    }
  }, [retailers])

  // Keep the active retailer valid as the country changes.
  useEffect(() => {
    setActive((prev) =>
      prev && eligible.some((r) => r.slug === prev.slug) ? prev : (eligible[0] ?? null),
    )
  }, [eligible])

  const pickCountry = (code: string) => {
    setCountry(code)
    setOverridden(true)
    try {
      window.localStorage.setItem(COUNTRY_KEY, code)
    } catch {
      /* fine — the choice still applies for this visit */
    }
  }

  /**
   * Forget the saved choice and go back to where the edge says you are.
   *
   * Without this, the first pick was permanent. Moving country — or turning on
   * a VPN — left the panel showing the old shops with no way back short of
   * clearing site data, which reads as "it didn't detect my location" because
   * from the outside that is exactly what it looks like.
   */
  const useDetected = () => {
    setCountry(defaultCountry)
    setOverridden(false)
    try {
      window.localStorage.removeItem(COUNTRY_KEY)
    } catch {
      /* the reset still applies for this visit */
    }
  }

  if (lines.length === 0) return null

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
        meta={active ? active.label : country ? countryName(country) : undefined}
        defaultOpen={false}
      >
        {/* Tiles, not text chips: people find their supermarket by its colour
            before they read its name, and eleven identical bordered chips is a
            wall to scan. */}
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {eligible.map((r) => {
            const tile = retailerTile(r.slug, r.label)
            const on = active?.slug === r.slug
            return (
              <li key={r.slug}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActive(r)}
                  className={`flex w-full min-w-0 items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                    on ? 'border-ink bg-wash' : 'border-rule hover:border-ink/40'
                  }`}
                >
                  {/* The shop's own mark where we have it, self-hosted. The
                      monogram sits underneath rather than beside it, so a
                      missing or failed image degrades to a coloured tile
                      instead of a broken-image icon. */}
                  <span
                    aria-hidden="true"
                    style={{ background: tile.bg, color: tile.fg }}
                    className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded font-mono text-[0.6875rem] font-bold"
                  >
                    {tile.initials}
                    {SHOP_LOGOS.has(r.slug) && (
                      // eslint-disable-next-line @next/next/no-img-element -- static self-hosted asset, no optimisation needed at 28px
                      <img
                        src={`/shops/${r.slug}.png`}
                        alt=""
                        width={28}
                        height={28}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full bg-white object-contain"
                      />
                    )}
                  </span>
                  <span className="min-w-0 truncate font-body text-[0.875rem] text-ink">{r.label}</span>
                  {on && (
                    <span aria-hidden="true" className="ml-auto shrink-0 text-[0.75rem] text-flame">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {eligible.length === 0 && (
          <p className="mt-3 mb-0 text-[0.875rem] text-slate">
            No shops listed for {country ? countryName(country) : 'your country'} yet — copy the
            list and take it anywhere.
          </p>
        )}

        {active && (
          <>
            {/* Once, in one place. This used to repeat "find at Tesco ↗" on
                every one of fifty-three rows, which is noise the reader has to
                read past rather than information. */}
            <p className="mt-4 mb-0 flex flex-wrap items-baseline gap-x-2 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">
              <span>
                {lines.length} {lines.length === 1 ? 'item' : 'items'} · tap one to search{' '}
                {active.label}
              </span>
              <span aria-hidden="true">↗</span>
            </p>
            {/* Columns, because fifty items in one file is a scroll, not a list. */}
            <ul className="m-0 mt-2 grid list-none grid-cols-1 gap-x-8 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {lines.map((line) => (
                <li key={line.key} className="border-b border-dotted border-rule">
                  <a
                    href={`/grocery/click?r=${active.id}&q=${encodeURIComponent(line.name)}`}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="group flex items-baseline justify-between gap-3 py-1.5 no-underline"
                  >
                    <span className="min-w-0 text-[0.9375rem] text-ink group-hover:text-flame">
                      {line.name}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-1.5">
                      {line.amounts.length > 0 && (
                        <span className="font-mono text-[0.75rem] tabular-nums text-slate">
                          {line.amounts.join(' + ')}
                        </span>
                      )}
                      {/* The arrow marks the row as a link without shouting the
                          retailer's name fifty times. */}
                      <span
                        aria-hidden="true"
                        className="text-[0.75rem] text-transparent group-hover:text-flame group-focus-visible:text-flame"
                      >
                        ↗
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
        <button type="button" onClick={() => void copy()} className="chip">
          {copied ? 'Copied ✓' : 'Copy list'}
        </button>
        <label className="flex flex-wrap items-center gap-2 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase">
          {detected && overridden && defaultCountry ? (
            <button
              type="button"
              onClick={useDetected}
              className="rounded border border-rule px-2 py-1 font-mono text-[0.6875rem] tracking-[0.08em] text-slate uppercase hover:border-flame hover:text-flame"
            >
              Use {countryName(defaultCountry)}
            </button>
          ) : null}
          Shopping somewhere else?
          <select
            value={country ?? ''}
            onChange={(e) => pickCountry(e.target.value)}
            className="rounded border border-rule bg-transparent px-2 py-1 font-mono text-[0.75rem] text-ink focus:border-flame focus:outline-none"
          >
            <option value="" disabled>
              Pick a country
            </option>
            <optgroup label={`With shops (${covered.length})`}>
              {covered.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="No shops listed yet — copy list still works">
              {uncovered.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        </div>
      </Disclosure>
    </div>
  )
}
