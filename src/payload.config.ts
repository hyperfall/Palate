import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Authors } from './collections/Authors'
import { BrandCards } from './collections/BrandCards'
import { Cuisines } from './collections/Cuisines'
import { Ingredients } from './collections/Ingredients'
import { Media } from './collections/Media'
import { Recipes } from './collections/Recipes'
import { Submissions } from './collections/Submissions'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Vercel Blob backs media in deployed environments (§4). Locally there is no
 * blob token, so uploads fall through to Payload's disk storage and
 * `npm run dev` works with no cloud account attached.
 */
const blobToken = process.env.BLOB_READ_WRITE_TOKEN
const storagePlugins = blobToken
  ? [
      vercelBlobStorage({
        enabled: true,
        collections: { media: true },
        token: blobToken,
      }),
    ]
  : []

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Recipe platform',
    },
  },
  collections: [Recipes, Ingredients, Cuisines, Authors, BrandCards, Media, Submissions, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [...storagePlugins],
})
