/**
 * Pure grocery-handoff logic: which retailers a viewer sees and where each
 * shopping-list line links. Server code (selection, click redirect) and tests
 * share these; nothing here touches Payload or the network.
 */

/** What country selection actually reads — the client picker passes rows
 *  WITHOUT templates, since destinations are rebuilt server-side on click and
 *  the templates have no business shipping to the browser. */
export type RetailerTargetingLike = {
  id: number | string
  label: string
  slug: string
  countries?: Array<{ code: string }> | null
  priority?: number | null
  active?: boolean | null
}

export type GroceryRetailerLike = RetailerTargetingLike & {
  searchUrlTemplate: string
  affiliateUrlTemplate?: string | null
}

/**
 * Active retailers eligible for a viewer country (ISO-2, any case; null when
 * geo headers are absent). Empty/missing `countries` targets globally — the
 * brandCards contract. Ordered by priority desc, then label.
 */
export function retailersForCountry<T extends RetailerTargetingLike>(
  retailers: T[],
  country: string | null | undefined,
): T[] {
  const cc = country?.trim().toUpperCase() || null
  return retailers
    .filter((r) => r.active !== false)
    .filter((r) => {
      const codes = (r.countries ?? []).map((c) => c.code.toUpperCase())
      return codes.length === 0 || (cc !== null && codes.includes(cc))
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.label.localeCompare(b.label))
}

/**
 * The outbound URL for one ingredient at one retailer: `{query}` substituted
 * (encoded), then wrapped in the affiliate template's `{url}` when configured.
 */
export function searchUrl(retailer: GroceryRetailerLike, query: string): string {
  const target = retailer.searchUrlTemplate.replaceAll('{query}', encodeURIComponent(query.trim()))
  const wrapper = retailer.affiliateUrlTemplate
  if (wrapper && wrapper.includes('{url}')) return wrapper.replaceAll('{url}', encodeURIComponent(target))
  return target
}

/** Plain-text export of the netted list — for Copy list / notes apps. */
export function shoppingListText(lines: Array<{ name: string; amounts: string[] }>): string {
  return lines
    .map((l) => (l.amounts.length > 0 ? `${l.name} — ${l.amounts.join(' + ')}` : l.name))
    .join('\n')
}
