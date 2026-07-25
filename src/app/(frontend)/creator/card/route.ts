import { NextResponse, type NextRequest } from 'next/server'

import { imageFrom } from '@/lib/media'
import { findAuthorByHandle } from '@/lib/queries'
import { cleanSocials } from '@/lib/socials'

/**
 * Minimal public author card, fetched lazily by the hover/tap profile card the
 * first time it opens. Keeps recipe list queries lean — the byline needs only a
 * handle; this fills in avatar, bio, and socials on demand.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams
    .get('handle')
    ?.replace(/^@+/, '')
    .trim()
    .toLowerCase()
  if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 })

  const author = await findAuthorByHandle(handle)
  if (!author) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json(
    {
      name: author.name,
      handle: author.handle,
      verified: Boolean(author.verified),
      avatarUrl: imageFrom(author.avatar, 'thumbnail')?.url ?? imageFrom(author.avatar)?.url ?? null,
      bio: (author.bio as string | undefined) ?? null,
      socials: cleanSocials((author.socials as Record<string, unknown>) ?? null),
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
