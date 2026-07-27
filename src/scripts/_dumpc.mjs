import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config })
const all = await payload.find({ collection: 'cuisines', limit: 400, depth: 0, sort: 'name' })
const done = new Set(['chinese','indian','italian','japanese','korean','levantine','mexican','thai'])
const fs = await import('node:fs')
const rows = all.docs
  .filter((d) => !done.has(String(d.name).toLowerCase()))
  .map((d) => `${d.name}\t${d.region ?? ''}\t${(d.description ?? '').replace(/\s+/g, ' ')}`)
fs.writeFileSync(process.env.OUT + '/all.tsv', rows.join('\n'))
console.log('total:', all.docs.length, 'remaining:', rows.length)
const regions = {}
for (const d of all.docs) regions[d.region ?? '?'] = (regions[d.region ?? '?'] ?? 0) + 1
console.log(JSON.stringify(regions))
