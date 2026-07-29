import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

import { RETAILERS } from './groceryRetailerData'

/**
 * Seeds the grocery retailer registry with sensible defaults. Idempotent:
 * existing retailers (by slug) are never touched, so admin edits (priorities,
 * affiliate templates once programs are approved) survive re-runs.
 *
 *   npm run seed:grocery
 */


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
