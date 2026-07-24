import { ShopThisList, type ShopLine } from '@/components/ShopThisList'
import { getGroceryRetailers, logGroceryImpressions, viewerCountry } from '@/lib/groceryData'

/**
 * Server wrapper for "Shop this list": resolves the viewer's country, picks
 * eligible retailers from the registry, logs one impression per retailer
 * shown, and renders the client panel. Renders nothing when there's nothing
 * to shop or no retailer serves the viewer's country.
 */
export async function GroceryPanel({ lines }: { lines: ShopLine[] }) {
  if (lines.length === 0) return null

  const country = await viewerCountry()
  const retailers = await getGroceryRetailers(country)
  if (retailers.length === 0) return null

  await logGroceryImpressions(
    retailers.map((r) => r.id),
    country,
  )

  return (
    <ShopThisList
      retailers={retailers.map(({ id, label, slug }) => ({ id, label, slug }))}
      lines={lines.map(({ key, name, amounts }) => ({ key, name, amounts }))}
    />
  )
}
