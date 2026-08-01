'use client'

import { useEffect, useState } from 'react'

import { ALL_COUNTRY_CODES, countryName } from '@/lib/countries'
import { readShopCountry, subscribeShopCountry, writeShopCountry } from '@/lib/shopCountry'

/**
 * Where you shop, set from the footer.
 *
 * The country used to be reachable only from the shop panel inside a meal
 * plan — behind a sign-in and a planned week — so a visitor in Germany browsed
 * the whole site being quietly treated as British with no way to say
 * otherwise. It belongs with the other site-wide settings.
 *
 * Client-only on purpose: reading the edge header here would call headers()
 * in the footer, which appears on every page, and would drag the entire site
 * out of static rendering to personalise one select.
 *
 * Renders nothing until mounted, because the stored choice is only knowable in
 * the browser and a server-rendered "United Kingdom" that flips after
 * hydration is worse than a beat of nothing.
 */
export function CountryChooser({ className = '' }: { className?: string }) {
  const [country, setCountry] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setCountry(readShopCountry())
    setReady(true)
    return subscribeShopCountry(setCountry)
  }, [])

  if (!ready) return null

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="eyebrow m-0 text-milk/70 uppercase">Shopping in</span>
      <select
        value={country ?? ''}
        onChange={(e) => {
          const code = e.target.value
          setCountry(code || null)
          writeShopCountry(code || null)
        }}
        className="max-w-[11rem] cursor-pointer truncate rounded border border-pan-line bg-transparent px-2 py-1 font-mono text-[0.75rem] text-milk hover:border-flame focus:border-flame focus:outline-none"
      >
        {/* "Wherever I am" is the honest label for the default: the edge
            proposes a country per request, so there is no single place to name. */}
        <option value="">Wherever I am</option>
        {ALL_COUNTRY_CODES.map((code) => ({ code, name: countryName(code) }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
      </select>
    </label>
  )
}
