import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Seeds the grocery retailer registry with sensible defaults. Idempotent:
 * existing retailers (by slug) are never touched, so admin edits (priorities,
 * affiliate templates once programs are approved) survive re-runs.
 *
 *   npm run seed:grocery
 */

type SeedRetailer = {
  label: string
  slug: string
  type: 'supermarket' | 'delivery' | 'marketplace'
  countries: string[]
  searchUrlTemplate: string
  priority: number
}

const RETAILERS: SeedRetailer[] = [
  // GB
  { label: 'Tesco', slug: 'tesco', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.tesco.com/groceries/en-GB/search?query={query}', priority: 50 },
  { label: 'Sainsbury’s', slug: 'sainsburys', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://www.sainsburys.co.uk/gol-ui/SearchResults/{query}', priority: 40 },
  { label: 'Asda', slug: 'asda', type: 'supermarket', countries: ['GB'], searchUrlTemplate: 'https://groceries.asda.com/search/{query}', priority: 30 },
  { label: 'Ocado', slug: 'ocado', type: 'delivery', countries: ['GB'], searchUrlTemplate: 'https://www.ocado.com/search?entry={query}', priority: 20 },
  { label: 'Amazon Fresh', slug: 'amazon-fresh-uk', type: 'marketplace', countries: ['GB'], searchUrlTemplate: 'https://www.amazon.co.uk/s?k={query}&i=amazonfresh', priority: 10 },
  // US
  { label: 'Walmart', slug: 'walmart', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.walmart.com/search?q={query}', priority: 50 },
  { label: 'Target', slug: 'target', type: 'supermarket', countries: ['US'], searchUrlTemplate: 'https://www.target.com/s?searchTerm={query}', priority: 40 },
  { label: 'Amazon Fresh', slug: 'amazon-fresh-us', type: 'marketplace', countries: ['US'], searchUrlTemplate: 'https://www.amazon.com/s?k={query}&i=amazonfresh', priority: 10 },
]

async function run() {
  const payload = await getPayload({ config })

  let created = 0
  for (const r of RETAILERS) {
    const existing = await payload.find({
      collection: 'groceryRetailers',
      where: { slug: { equals: r.slug } },
      limit: 1,
      depth: 0,
    })
    if (existing.totalDocs > 0) continue

    await payload.create({
      collection: 'groceryRetailers',
      data: {
        label: r.label,
        slug: r.slug,
        type: r.type,
        countries: r.countries.map((code) => ({ code })),
        searchUrlTemplate: r.searchUrlTemplate,
        priority: r.priority,
        active: true,
        network: 'none',
      },
    })
    created++
    console.log(`  + ${r.label} (${r.countries.join(', ')})`)
  }

  console.log(`Done: ${created} created, ${RETAILERS.length - created} already present.`)
  process.exit(0)
}

void run()
