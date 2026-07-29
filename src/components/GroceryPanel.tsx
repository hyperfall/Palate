import { ShopThisList, type ShopLine, type ShopRetailer } from '@/components/ShopThisList'
import { retailersForCountry } from '@/lib/grocery'
import { getAllGroceryRetailers, logGroceryImpressions, viewerCountry } from '@/lib/groceryData'

/**
 * Server wrapper for "Shop this list". The IP header only proposes the
 * country — the client owns the decision, because the header is absent in
 * dev, wrong on VPNs, and unhelpful for a traveller. So the whole active
 * registry ships to the client (~70 tiny rows) with the detected country as
 * the default, and the panel filters with the same pure retailersForCountry
 * the server used to run.
 *
 * Renders nothing only when there is nothing to shop — an uncovered country
 * now gets the copy-list fallback instead of silence.
 */
export async function GroceryPanel({ lines }: { lines: ShopLine[] }) {
  if (lines.length === 0) return null

  const country = await viewerCountry()
  const all = await getAllGroceryRetailers()

  // Impressions for the default-country set — the view most readers get.
  // Client-side country switches don't log; a small undercount beats a new
  // endpoint.
  const shown = retailersForCountry(all, country)
  await logGroceryImpressions(
    shown.map((r) => r.id),
    country,
  )

  const slim: ShopRetailer[] = all.map(({ id, label, slug, countries, priority, active }) => ({
    id,
    label,
    slug,
    countries: (countries ?? []).map((c) => ({ code: c.code })),
    priority: priority ?? 0,
    active: active !== false,
  }))

  return (
    <ShopThisList
      retailers={slim}
      defaultCountry={country}
      lines={lines.map(({ key, name, amounts }) => ({ key, name, amounts }))}
    />
  )
}
